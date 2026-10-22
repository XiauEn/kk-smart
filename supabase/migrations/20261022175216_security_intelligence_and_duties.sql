-- Additive security planning features. All identities and existing data are fictional.
alter table public.account_roles drop constraint account_roles_role_check;
alter table public.account_roles add constraint account_roles_role_check check(role in ('management','terminal','guard'));
create table public.guard_blocks (
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 block_id uuid not null references public.residential_blocks(id), primary key(auth_user_id,block_id)
);
create index guard_blocks_block on public.guard_blocks(block_id);
alter table public.guard_blocks enable row level security;
revoke all on public.guard_blocks from public,anon,authenticated;
grant select on public.guard_blocks to authenticated;
grant all on public.guard_blocks to service_role;
create policy guard_scope_self on public.guard_blocks for select to authenticated using(auth_user_id=(select auth.uid()) or (select public.is_management()));
create table public.security_duties (
 id uuid primary key default gen_random_uuid(), block_id uuid not null references public.residential_blocks(id),
 starts_at timestamptz not null, ends_at timestamptz not null,
 instructions text not null check(length(trim(instructions)) between 5 and 1000),
 status text not null default 'draft' check(status in ('draft','published','cancelled')),
 source_label text not null default 'Management decision · Demo Data' check(length(source_label)<=200),
 updated_at timestamptz not null default clock_timestamp(), version integer not null default 1,
 updated_by uuid not null references auth.users(id), approved_by uuid references auth.users(id), approved_at timestamptz,
 check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'),
 check(status<>'published' or (approved_by is not null and approved_at is not null))
);
create index security_duties_block_time on public.security_duties(block_id,starts_at);
create index security_duties_updated_by on public.security_duties(updated_by);
create index security_duties_approved_by on public.security_duties(approved_by);
alter table public.security_duties enable row level security;
revoke all on public.security_duties from public,anon,authenticated;
grant select on public.security_duties to authenticated;
grant all on public.security_duties to service_role;
create policy duties_read on public.security_duties for select to authenticated using(
 (select public.is_management()) or (status='published' and exists(select 1 from public.account_roles r join public.guard_blocks g on g.auth_user_id=r.auth_user_id where r.auth_user_id=(select auth.uid()) and r.role='guard' and g.block_id=security_duties.block_id))
);
-- Scoped alert visibility supports guard operations without exposing student movement logs.
create policy alerts_guard on public.security_alerts for select to authenticated using(exists(select 1 from public.account_roles r join public.guard_blocks g on g.auth_user_id=r.auth_user_id where r.auth_user_id=(select auth.uid()) and r.role='guard' and g.block_id=security_alerts.block_id));

create function public.kk_duties(p_actor uuid,p_from date,p_to date) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_role text; begin
 select role into v_role from public.account_roles where auth_user_id=p_actor;
 if v_role is null or v_role not in ('management','guard') then raise exception 'Management or guard account required'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>31 then raise exception 'Select up to 32 days'; end if;
 return jsonb_build_object('server_time',clock_timestamp(),'duties',(select coalesce(jsonb_agg(to_jsonb(d) order by starts_at),'[]'::jsonb) from public.security_duties d where d.starts_at < (p_to+1)::timestamp at time zone 'Asia/Kuala_Lumpur' and d.ends_at>p_from::timestamp at time zone 'Asia/Kuala_Lumpur' and (v_role='management' or d.status='published' and exists(select 1 from public.guard_blocks g where g.auth_user_id=p_actor and g.block_id=d.block_id))));
end $$;
create function public.kk_save_duty(p_actor uuid,p_duty jsonb,p_approve boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_old public.security_duties%rowtype; v_new public.security_duties%rowtype; v_id uuid:=nullif(p_duty->>'id','')::uuid; v_status text:=p_duty->>'status'; begin
 if not exists(select 1 from public.account_roles where auth_user_id=p_actor and role='management') then raise exception 'Management account required'; end if;
 if v_status is null or v_status not in ('draft','published','cancelled') then raise exception 'Invalid duty status'; end if;
 if v_status='published' and p_approve is distinct from true then raise exception 'Explicit human approval required'; end if;
 if v_id is not null then
  select * into v_old from public.security_duties where id=v_id for update;
  if v_old.id is null or v_old.version is distinct from (p_duty->>'version')::integer then raise exception 'Duty changed. Refresh before saving'; end if;
 end if;
 insert into public.security_duties(id,block_id,starts_at,ends_at,instructions,status,source_label,updated_by,approved_by,approved_at)
 values(coalesce(v_id,gen_random_uuid()),(p_duty->>'block_id')::uuid,(p_duty->>'starts_at')::timestamptz,(p_duty->>'ends_at')::timestamptz,trim(p_duty->>'instructions'),v_status,coalesce(nullif(p_duty->>'source_label',''),'Management decision · Demo Data'),p_actor,case when v_status='published' then p_actor end,case when v_status='published' then clock_timestamp() end)
 on conflict(id) do update set block_id=excluded.block_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,instructions=excluded.instructions,status=excluded.status,source_label=excluded.source_label,updated_by=p_actor,updated_at=clock_timestamp(),version=security_duties.version+1,approved_by=excluded.approved_by,approved_at=excluded.approved_at returning * into v_new;
 insert into public.audit_log(actor_id,action,target_id,before_data,after_data) values(p_actor,'duty_'||v_status,v_new.id,case when v_old.id is not null then to_jsonb(v_old) end,to_jsonb(v_new));
 return to_jsonb(v_new);
end $$;
create function public.kk_guard_snapshot(p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.account_roles where auth_user_id=p_actor and role='guard') then raise exception 'Guard account required'; end if;
 return jsonb_build_object('server_time',clock_timestamp(),'students','[]'::jsonb,'events','[]'::jsonb,'holidays','[]'::jsonb,
 'blocks',(select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) from public.residential_blocks b join public.guard_blocks g on g.block_id=b.id where g.auth_user_id=p_actor),
 'alerts',(select coalesce(jsonb_agg(to_jsonb(a) order by timestamp desc),'[]'::jsonb) from public.security_alerts a where exists(select 1 from public.guard_blocks g where g.auth_user_id=p_actor and g.block_id=a.block_id)));
end $$;
create function public.kk_guard_alert_status(p_actor uuid,p_id uuid,p_status text) returns void language plpgsql security invoker set search_path='' as $$
declare v_block uuid; begin
 select block_id into v_block from public.security_alerts where id=p_id for update;
 if not exists(select 1 from public.account_roles r join public.guard_blocks g on g.auth_user_id=r.auth_user_id where r.auth_user_id=p_actor and r.role='guard' and g.block_id=v_block) then raise exception 'Authorised guard scope required'; end if;
 if p_status is null or p_status not in ('new','under_review','resolved') then raise exception 'Invalid alert status'; end if;
 update public.security_alerts set status=p_status where id=p_id;
 insert into public.audit_log(actor_id,action,target_id,after_data) values(p_actor,'guard_alert_review',p_id,jsonb_build_object('status',p_status));
end $$;

create function public.kk_intelligence(p_actor uuid,p_from date,p_to date,p_period uuid default null,p_demo boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_hourly jsonb; v_blocks jsonb; v_holiday jsonb; begin
 if not exists(select 1 from public.account_roles where auth_user_id=p_actor and role='management') then raise exception 'Management account required'; end if;
 if p_from is null or p_to is null or p_to-p_from<>6 or p_to> (clock_timestamp() at time zone 'Asia/Kuala_Lumpur')::date then raise exception 'Select a seven-day window ending today or earlier'; end if;
 -- Cells with fewer than 5 distinct successful entrants are suppressed. Released counts are rounded to nearest 5.
 with current_entries as (select block_id,extract(hour from timestamp at time zone 'Asia/Kuala_Lumpur')::int as hour,count(*) as n,count(distinct student_id) as people from public.access_events where granted and (timestamp at time zone 'Asia/Kuala_Lumpur')::date between p_from and p_to group by 1,2),
 baseline as (select block_id,extract(hour from timestamp at time zone 'Asia/Kuala_Lumpur')::int as hour,count(*)/4.0 as average,count(distinct student_id) as people,count(distinct w) as periods from public.access_events cross join generate_series(1,4) w where granted and (timestamp at time zone 'Asia/Kuala_Lumpur')::date between p_from-w*7 and p_to-w*7 group by 1,2)
 select coalesce(jsonb_agg(jsonb_build_object('block_id',b.id,'label',b.kk_name||' · Block '||b.block_name,'hour',h,'entries',case when coalesce(c.n,0)=0 then 0 when c.people>=5 then round(c.n/5.0)*5 end,'baseline',case when a.people>=5 and a.periods>=3 then round(a.average/5.0)*5 end,'baseline_periods',coalesce(a.periods,0)) order by b.kk_name,b.block_name,h),'[]'::jsonb) into v_hourly from public.residential_blocks b cross join generate_series(0,23) h left join current_entries c on c.block_id=b.id and c.hour=h left join baseline a on a.block_id=b.id and a.hour=h;
 select coalesce(jsonb_agg(jsonb_build_object('block_id',b.id,'label',b.kk_name||' · Block '||b.block_name,
 'entries',case when e.people>=5 then round(e.n/5.0)*5 when coalesce(e.n,0)=0 then 0 end,
 'denied',case when e.denied>=5 then round(e.denied/5.0)*5 when coalesce(e.denied,0)=0 then 0 end)),'[]'::jsonb) into v_blocks from public.residential_blocks b left join (select block_id,count(*) filter(where granted) as n,count(distinct student_id) filter(where granted) as people,count(*) filter(where not granted) as denied from public.access_events where (timestamp at time zone 'Asia/Kuala_Lumpur')::date between p_from and p_to group by block_id) e on e.block_id=b.id;
 select coalesce(jsonb_agg(jsonb_build_object('block_id',b.id,'label',b.kk_name||' · Block '||b.block_name,
 'residents',case when r.n>=5 then round(r.n/5.0)*5 end,'stays',case when s.n>=5 then round(s.n/5.0)*5 when coalesce(s.n,0)=0 then 0 end,
 'percentage',case when r.n>=10 and s.n>=5 then round(s.n*10.0/r.n)*10 end)),'[]'::jsonb) into v_holiday from public.residential_blocks b
 left join (select block_id,count(*) as n from public.residencies where status='active' and end_date>=(clock_timestamp() at time zone 'Asia/Kuala_Lumpur')::date group by block_id) r on r.block_id=b.id
 left join (select r.block_id,count(distinct h.student_id) as n from public.holiday_declarations h join public.residencies r on r.student_id=h.student_id where h.period_id=p_period and h.staying and r.status='active' and r.end_date>=(clock_timestamp() at time zone 'Asia/Kuala_Lumpur')::date group by r.block_id) s on s.block_id=b.id;
 if p_demo then
  -- Explicit demonstration aggregates only: no fake events are inserted into access logs.
  select jsonb_build_array(jsonb_build_object('block_id',id,'label',kk_name||' · Block '||block_name,'hour',3,'entries',30,'baseline',10,'baseline_periods',4)) into v_hourly from public.residential_blocks order by kk_name,block_name limit 1;
 end if;
 return jsonb_build_object('server_time',clock_timestamp(),'from',p_from,'to',p_to,'source',case when p_demo then 'Synthetic planning scenario · NOT access log records' else 'Stored access events and declarations · Demo Data' end,'hourly',v_hourly,'blocks',v_blocks,'holiday',v_holiday,'privacy','Cells with fewer than five successful entrants suppressed; counts rounded to nearest 5, declaration shares to nearest 10 percentage points. No student identifiers returned.','baseline_note','Same weekday/hour windows in the previous four weeks. At least three populated windows required. Zero rounded baselines cannot trigger a peak insight.');
end $$;
revoke all on function public.kk_duties(uuid,date,date),public.kk_save_duty(uuid,jsonb,boolean),public.kk_guard_snapshot(uuid),public.kk_guard_alert_status(uuid,uuid,text),public.kk_intelligence(uuid,date,date,uuid,boolean) from public,anon,authenticated;
grant execute on function public.kk_duties(uuid,date,date),public.kk_save_duty(uuid,jsonb,boolean),public.kk_guard_snapshot(uuid),public.kk_guard_alert_status(uuid,uuid,text),public.kk_intelligence(uuid,date,date,uuid,boolean) to service_role;
alter publication supabase_realtime add table public.security_duties,public.guard_blocks;
