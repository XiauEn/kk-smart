create table public.holiday_periods (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check(length(trim(name)) between 3 and 100),
 start_date date not null, end_date date not null, declaration_deadline date not null,
 check(end_date >= start_date and end_date-start_date <= 120),
 check(declaration_deadline <= end_date)
);
alter table public.holiday_periods enable row level security;
revoke all on public.holiday_periods from public,anon,authenticated;
grant select on public.holiday_periods to authenticated;
grant all on public.holiday_periods to service_role;
create policy holiday_periods_read on public.holiday_periods for select to authenticated using (true);

-- Preserve the existing fictional declarations and their original dates.
insert into public.holiday_periods(name,start_date,end_date,declaration_deadline)
select holiday_name,min(start_date),max(end_date),max(end_date) from public.holiday_declarations group by holiday_name;
insert into public.holiday_periods(name,start_date,end_date,declaration_deadline)
select 'Semester break',current_date,current_date+14,current_date+14 where not exists(select 1 from public.holiday_periods where name='Semester break');
insert into public.holiday_periods(name,start_date,end_date,declaration_deadline)
values ('Year-end break · Demo',date '2026-12-01',date '2026-12-14',date '2026-11-27') on conflict(name) do nothing;
alter table public.holiday_declarations add column period_id uuid references public.holiday_periods(id);
alter table public.holiday_declarations add column response text not null default 'entire' check(response in ('entire','dates','away','unsure'));
update public.holiday_declarations h set period_id=p.id,response=case when h.staying then case when h.start_date=p.start_date and h.end_date=p.end_date then 'entire' else 'dates' end else 'away' end from public.holiday_periods p where p.name=h.holiday_name;
alter table public.holiday_declarations alter column period_id set not null;
create unique index holiday_declarations_student_period on public.holiday_declarations(student_id,period_id);
create index holiday_declarations_period on public.holiday_declarations(period_id);

alter function public.kk_snapshot(uuid,text) rename to kk_snapshot_base;
create function public.kk_snapshot(p_actor uuid,p_role text) returns jsonb language sql security invoker set search_path='' as $$
 select public.kk_snapshot_base(p_actor,p_role) || jsonb_build_object('holiday_periods',(select coalesce(jsonb_agg(to_jsonb(p) order by start_date),'[]'::jsonb) from public.holiday_periods p));
$$;
revoke all on function public.kk_snapshot(uuid,text) from public,anon,authenticated;
grant execute on function public.kk_snapshot(uuid,text) to service_role;

create or replace function public.kk_declare(p_actor uuid,p_declaration jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare v_student uuid; p public.holiday_periods%rowtype; v_response text; v_from date; v_to date; begin
 select id into v_student from public.students where auth_user_id=p_actor;
 if v_student is null then raise exception 'Student account required'; end if;
 -- Backward compatibility for the old app during the deployment rollout.
 select * into p from public.holiday_periods where id=nullif(p_declaration->>'period_id','')::uuid or (p_declaration->>'period_id' is null and name=p_declaration->>'holiday_name');
 if p.id is null then raise exception 'Published holiday required'; end if;
 if (clock_timestamp() at time zone 'Asia/Kuala_Lumpur')::date > p.declaration_deadline then raise exception 'Declaration deadline has passed'; end if;
 v_response:=coalesce(p_declaration->>'response',case when (p_declaration->>'staying')::boolean then 'dates' else 'away' end);
 if v_response not in ('entire','dates','away','unsure') or v_response is null then raise exception 'Invalid stay plan'; end if;
 if v_response='dates' then v_from:=(p_declaration->>'start_date')::date; v_to:=(p_declaration->>'end_date')::date;
 else v_from:=p.start_date; v_to:=p.end_date; end if;
 if v_from is null or v_to is null or v_from<p.start_date or v_to>p.end_date or v_to<v_from then raise exception 'Stay dates must be within holiday'; end if;
 insert into public.holiday_declarations(student_id,period_id,holiday_name,start_date,end_date,staying,response)
 values(v_student,p.id,p.name,v_from,v_to,v_response in ('entire','dates'),v_response)
 on conflict(student_id,holiday_name) do update set period_id=excluded.period_id,start_date=excluded.start_date,end_date=excluded.end_date,staying=excluded.staying,response=excluded.response;
end $$;

create function public.kk_holiday_period(p_actor uuid,p_period jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare v_id uuid; begin
 if not exists(select 1 from public.account_roles where auth_user_id=p_actor and role='management') then raise exception 'Management account required'; end if;
 if nullif(trim(p_period->>'name'),'') is null or p_period->>'start_date' is null or p_period->>'end_date' is null or p_period->>'declaration_deadline' is null then raise exception 'Name, dates and deadline required'; end if;
 insert into public.holiday_periods(name,start_date,end_date,declaration_deadline) values(trim(p_period->>'name'),(p_period->>'start_date')::date,(p_period->>'end_date')::date,(p_period->>'declaration_deadline')::date) returning id into v_id;
 insert into public.audit_log(actor_id,action,target_id,after_data) values(p_actor,'holiday_period_created',v_id,p_period);
end $$;

create function public.kk_student_history(p_actor uuid,p_student uuid,p_from date default null,p_to date default null,p_offset integer default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_result jsonb; begin
 if not exists(select 1 from public.account_roles where auth_user_id=p_actor and role='management') then raise exception 'Management account required'; end if;
 if not exists(select 1 from public.students where id=p_student) then raise exception 'Unknown student'; end if;
 if p_offset is null or p_offset<0 or (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'Invalid history filters'; end if;
 select jsonb_build_object('total',(select count(*) from public.access_events e where e.student_id=p_student and (p_from is null or e.timestamp >= p_from::timestamp at time zone 'Asia/Kuala_Lumpur') and (p_to is null or e.timestamp < (p_to+1)::timestamp at time zone 'Asia/Kuala_Lumpur')),
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by timestamp desc,id desc),'[]'::jsonb) from (select * from public.access_events e where e.student_id=p_student and (p_from is null or e.timestamp >= p_from::timestamp at time zone 'Asia/Kuala_Lumpur') and (p_to is null or e.timestamp < (p_to+1)::timestamp at time zone 'Asia/Kuala_Lumpur') order by timestamp desc,id desc limit 50 offset p_offset) e)) into v_result;
 insert into public.audit_log(actor_id,action,target_id,after_data) values(p_actor,'student_history_view',p_student,jsonb_build_object('from',p_from,'to',p_to,'offset',p_offset));
 return v_result;
end $$;
revoke all on function public.kk_holiday_period(uuid,jsonb),public.kk_student_history(uuid,uuid,date,date,integer) from public,anon,authenticated;
grant execute on function public.kk_holiday_period(uuid,jsonb),public.kk_student_history(uuid,uuid,date,date,integer) to service_role;
alter publication supabase_realtime add table public.holiday_periods;
