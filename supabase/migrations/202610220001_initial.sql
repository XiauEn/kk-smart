-- KK Smart: fictional competition prototype. All trusted operations are service-only RPCs.
create extension if not exists pgcrypto with schema extensions;
create table public.students (
 id uuid primary key default gen_random_uuid(), auth_user_id uuid unique references auth.users(id) on delete set null,
 student_id text not null unique, name text not null, year_of_study integer not null check(year_of_study between 1 and 4), faculty text not null
);
create table public.residential_blocks (id uuid primary key default gen_random_uuid(), kk_name text not null, block_name text not null, capacity integer not null check(capacity>0), unique(kk_name,block_name));
create table public.residencies (
 id uuid primary key default gen_random_uuid(), student_id uuid not null unique references public.students(id), block_id uuid not null references public.residential_blocks(id), room_number text not null check(length(room_number) between 1 and 30),
 start_date date not null default current_date, end_date date not null, status text not null check(status in ('active','expired')), check(end_date>=start_date)
);
create table public.account_roles (auth_user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('management','terminal')));
create table public.gate_terminals (id uuid primary key default gen_random_uuid(), auth_user_id uuid not null unique references auth.users(id) on delete cascade, block_id uuid not null references public.residential_blocks(id), name text not null, revoked boolean not null default false);
create table public.approved_permissions (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id), block_id uuid not null references public.residential_blocks(id), starts_at timestamptz not null, ends_at timestamptz not null, approved_by uuid not null references auth.users(id), revoked boolean not null default false, check(ends_at>starts_at));
create table public.qr_credentials (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id), credential_hash text not null unique, issued_at timestamptz not null, expires_at timestamptz not null, used_at timestamptz, revoked_at timestamptz, check(expires_at=issued_at+interval '15 seconds'));
create table public.access_events (id uuid primary key default gen_random_uuid(), student_id uuid references public.students(id), block_id uuid not null references public.residential_blocks(id), terminal_id uuid references public.gate_terminals(id), timestamp timestamptz not null default now(), granted boolean not null, denial_reason text, verification_method text not null default 'short_lived_qr', synced_at timestamptz not null default now());
create table public.security_alerts (id uuid primary key default gen_random_uuid(), block_id uuid not null references public.residential_blocks(id), terminal_id uuid references public.gate_terminals(id), timestamp timestamptz not null default now(), alert_type text not null, status text not null default 'new' check(status in ('new','under_review','resolved')), description text not null);
create table public.holiday_declarations (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id), holiday_name text not null check(length(holiday_name) between 1 and 80), start_date date not null, end_date date not null, staying boolean not null, unique(student_id,holiday_name), check(end_date>=start_date));
create table public.audit_log (id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users(id), action text not null, target_id uuid, before_data jsonb, after_data jsonb, timestamp timestamptz not null default now());
-- Offline events are explicitly untrusted, synthetic telemetry. They NEVER enter access_events.
create table public.offline_demo_events (id uuid primary key, terminal_id uuid not null references public.gate_terminals(id), reported_timestamp timestamptz not null, reported_granted boolean not null, verification_method text not null check(verification_method='offline_simulation'), received_at timestamptz not null default now());
create index access_events_block_time on public.access_events(block_id,timestamp desc);
create index access_events_terminal_failures on public.access_events(terminal_id,timestamp desc) where not granted;
create index access_events_student_time on public.access_events(student_id,timestamp desc);
create index security_alerts_terminal_time on public.security_alerts(terminal_id,timestamp desc);
create index qr_credentials_expiry on public.qr_credentials(expires_at);
create index approved_permissions_lookup on public.approved_permissions(student_id,block_id,ends_at);
create index holiday_period on public.holiday_declarations(start_date,end_date);

create function public.is_management() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.account_roles where auth_user_id=auth.uid() and role='management') $$;
revoke all on function public.is_management() from public;
grant execute on function public.is_management() to authenticated;
do $$ declare t text; begin foreach t in array array['students','residential_blocks','residencies','account_roles','gate_terminals','approved_permissions','qr_credentials','access_events','security_alerts','holiday_declarations','audit_log','offline_demo_events'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); execute format('grant select on public.%I to authenticated',t); end loop; end $$;
create policy students_read on public.students for select to authenticated using(auth_user_id=auth.uid() or public.is_management());
create policy blocks_read on public.residential_blocks for select to authenticated using(true);
create policy residencies_read on public.residencies for select to authenticated using(public.is_management() or exists(select 1 from public.students s where s.id=residencies.student_id and s.auth_user_id=auth.uid()));
create policy roles_self on public.account_roles for select to authenticated using(auth_user_id=auth.uid());
create policy terminals_self on public.gate_terminals for select to authenticated using(auth_user_id=auth.uid() or public.is_management());
create policy events_management on public.access_events for select to authenticated using(public.is_management());
create policy alerts_management on public.security_alerts for select to authenticated using(public.is_management());
create policy holidays_read on public.holiday_declarations for select to authenticated using(public.is_management() or exists(select 1 from public.students s where s.id=holiday_declarations.student_id and s.auth_user_id=auth.uid()));
create policy audit_management on public.audit_log for select to authenticated using(public.is_management());
-- No browser policies for QR hashes, approved_permissions or offline telemetry. No direct browser mutations.

create function public.kk_issue(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_student uuid; v_token text; v_now timestamptz; begin
 select id into v_student from public.students where auth_user_id=p_actor for update;
 if v_student is null then raise exception 'Student account required'; end if;
 -- Limit repeated issuance without revoking an already displayed credential.
 if (select count(*) from public.qr_credentials where student_id=v_student and issued_at>clock_timestamp()-interval '1 minute')>=12 then raise exception 'Please wait before refreshing again'; end if;
 v_now:=clock_timestamp(); v_token:='KK1.'||encode(extensions.gen_random_bytes(32),'hex');
 insert into public.qr_credentials(student_id,credential_hash,issued_at,expires_at) values(v_student,encode(extensions.digest(v_token,'sha256'),'hex'),v_now,v_now+interval '15 seconds');
 return jsonb_build_object('token',v_token,'issued_at',v_now,'expires_at',v_now+interval '15 seconds','server_time',clock_timestamp());
end $$;

create function public.kk_verify(p_actor uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.gate_terminals%rowtype; c public.qr_credentials%rowtype; e public.access_events%rowtype; a public.security_alerts%rowtype; v_now timestamptz; v_reason text; v_name text; v_granted boolean:=false; begin
 -- Serialise decisions per physical terminal. Its block comes only from the stored terminal identity.
 select gt.* into t from public.gate_terminals gt join public.account_roles r on r.auth_user_id=gt.auth_user_id and r.role='terminal' where gt.auth_user_id=p_actor and not gt.revoked for update of gt;
 if t.id is null then raise exception 'Authorised terminal required'; end if;
 select * into c from public.qr_credentials where credential_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 v_now:=clock_timestamp();
 if c.id is null then v_reason:='Invalid QR credential';
 elsif c.revoked_at is not null then v_reason:='QR credential revoked';
 elsif c.used_at is not null then v_reason:='QR credential already used';
 elsif c.expires_at<=v_now or c.issued_at>v_now then v_reason:='QR credential expired';
 else
   -- One-time consumption and event logging happen in this same transaction, including denied permissions.
   update public.qr_credentials set used_at=v_now where id=c.id;
   select name into v_name from public.students where id=c.student_id;
   v_granted:=exists(select 1 from public.residencies r where r.student_id=c.student_id and r.block_id=t.block_id and r.status='active' and r.start_date<=(v_now at time zone 'Asia/Kuala_Lumpur')::date and r.end_date>=(v_now at time zone 'Asia/Kuala_Lumpur')::date)
     or exists(select 1 from public.approved_permissions p where p.student_id=c.student_id and p.block_id=t.block_id and not p.revoked and p.starts_at<=v_now and p.ends_at>v_now);
   if not v_granted then
     if exists(select 1 from public.residencies where student_id=c.student_id and (status='expired' or end_date<(v_now at time zone 'Asia/Kuala_Lumpur')::date)) then v_reason:='Residential permission expired'; else v_reason:='No active block permission'; end if;
   end if;
 end if;
 insert into public.access_events(student_id,block_id,terminal_id,timestamp,granted,denial_reason) values(c.student_id,t.block_id,t.id,v_now,v_granted,v_reason) returning * into e;
 if not v_granted and (select count(*) from public.access_events where terminal_id=t.id and not granted and timestamp between v_now-interval '2 minutes' and v_now)>=5
 and not exists(select 1 from public.security_alerts where terminal_id=t.id and timestamp>v_now-interval '2 minutes') then
   insert into public.security_alerts(block_id,terminal_id,timestamp,alert_type,description) values(t.block_id,t.id,v_now,'five_failures','Five denied attempts within two minutes. Human review required; not evidence of wrongdoing.') returning * into a;
 end if;
 return jsonb_build_object('granted',v_granted,'reason',coalesce(v_reason,'Active residential permission'),'name',v_name,'block',(select kk_name||' · Block '||block_name from public.residential_blocks where id=t.block_id),'event',to_jsonb(e),'alert',case when a.id is null then null else to_jsonb(a) end);
end $$;

create function public.kk_snapshot(p_actor uuid,p_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_student uuid; v_terminal public.gate_terminals%rowtype; v_management boolean; v_result jsonb; begin
 select exists(select 1 from public.account_roles where auth_user_id=p_actor and role='management') into v_management;
 if p_role='management' and not v_management then raise exception 'Management account required'; end if;
 if p_role='student' then select id into v_student from public.students where auth_user_id=p_actor; if v_student is null then raise exception 'Student account required'; end if; end if;
 if p_role='terminal' then select t.* into v_terminal from public.gate_terminals t join public.account_roles r on r.auth_user_id=t.auth_user_id and r.role='terminal' where t.auth_user_id=p_actor and not t.revoked; if v_terminal.id is null then raise exception 'Authorised terminal required'; end if; end if;
 if p_role not in ('management','student','terminal') then raise exception 'Invalid role'; end if;
 select jsonb_build_object(
  'server_time',clock_timestamp(), 'terminal_block_id',v_terminal.block_id,
  'blocks',(select coalesce(jsonb_agg(to_jsonb(b) order by kk_name,block_name),'[]'::jsonb) from public.residential_blocks b),
  'students',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'student_id',s.student_id,'name',s.name,'year_of_study',s.year_of_study,'faculty',s.faculty,'block_id',r.block_id,'room_number',r.room_number,'end_date',r.end_date,'status',case when r.id is null then 'none' when r.status='expired' or r.end_date<(now() at time zone 'Asia/Kuala_Lumpur')::date then 'expired' else r.status end) order by s.student_id),'[]'::jsonb) from public.students s left join public.residencies r on r.student_id=s.id where p_role='management' or p_role='student' and s.id=v_student),
  'events',(select coalesce(jsonb_agg(to_jsonb(ev) order by timestamp desc),'[]'::jsonb) from (select * from public.access_events where timestamp>=((now() at time zone 'Asia/Kuala_Lumpur')::date-59)::timestamp at time zone 'Asia/Kuala_Lumpur' and (p_role='management' or p_role='terminal' and terminal_id=v_terminal.id) order by timestamp desc limit 30000) ev),
  'alerts',(select coalesce(jsonb_agg(to_jsonb(al) order by timestamp desc),'[]'::jsonb) from public.security_alerts al where p_role='management' or p_role='terminal' and terminal_id=v_terminal.id),
  'holidays',(select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb) from public.holiday_declarations h where p_role='management' or p_role='student' and student_id=v_student)
 ) into v_result;
 return v_result;
end $$;

create function public.kk_manage_residency(p_actor uuid,p_student jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid:=(p_student->>'id')::uuid; v_status text:=p_student->>'status'; v_old jsonb; begin
 if not exists(select 1 from public.account_roles where auth_user_id=p_actor and role='management') then raise exception 'Management account required'; end if;
 perform 1 from public.students where id=v_id for update; if not found then raise exception 'Unknown student'; end if;
 if v_status not in ('active','expired','none') then raise exception 'Invalid permission status'; end if;
 select to_jsonb(r) into v_old from public.residencies r where student_id=v_id;
 if v_status='none' then delete from public.residencies where student_id=v_id;
 else
  if not exists(select 1 from public.residential_blocks where id=(p_student->>'block_id')::uuid) or length(trim(p_student->>'room_number')) not between 1 and 30 or p_student->>'end_date' is null then raise exception 'Valid block, room and end date required'; end if;
  if v_status='active' and (p_student->>'end_date')::date<(now() at time zone 'Asia/Kuala_Lumpur')::date then raise exception 'Active permission needs a current or future end date'; end if;
  insert into public.residencies(student_id,block_id,room_number,start_date,end_date,status) values(v_id,(p_student->>'block_id')::uuid,trim(p_student->>'room_number'),least((now() at time zone 'Asia/Kuala_Lumpur')::date,(p_student->>'end_date')::date),(p_student->>'end_date')::date,v_status)
  on conflict(student_id) do update set block_id=excluded.block_id,room_number=excluded.room_number,start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status;
 end if;
 insert into public.audit_log(actor_id,action,target_id,before_data,after_data) values(p_actor,'residency_update',v_id,v_old,(select to_jsonb(r) from public.residencies r where student_id=v_id));
end $$;
create function public.kk_alert_status(p_actor uuid,p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare v_old jsonb; begin
 if not exists(select 1 from public.account_roles where auth_user_id=p_actor and role='management') then raise exception 'Management account required'; end if;
 if p_status not in ('new','under_review','resolved') then raise exception 'Invalid alert status'; end if;
 select to_jsonb(a) into v_old from public.security_alerts a where id=p_id for update; if v_old is null then raise exception 'Unknown alert'; end if;
 update public.security_alerts set status=p_status where id=p_id;
 insert into public.audit_log(actor_id,action,target_id,before_data,after_data) values(p_actor,'alert_status',p_id,v_old,jsonb_build_object('status',p_status));
end $$;
create function public.kk_declare(p_actor uuid,p_declaration jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v_student uuid; begin
 select id into v_student from public.students where auth_user_id=p_actor; if v_student is null then raise exception 'Student account required'; end if;
 if p_declaration->>'holiday_name'<>'Semester break' or (p_declaration->>'end_date')::date-(p_declaration->>'start_date')::date>60 then raise exception 'Invalid demo holiday'; end if;
 insert into public.holiday_declarations(student_id,holiday_name,start_date,end_date,staying) values(v_student,p_declaration->>'holiday_name',(p_declaration->>'start_date')::date,(p_declaration->>'end_date')::date,(p_declaration->>'staying')::boolean)
 on conflict(student_id,holiday_name) do update set start_date=excluded.start_date,end_date=excluded.end_date,staying=excluded.staying;
end $$;
-- Service-role is available ONLY inside the edge function. Actor UUIDs are taken from verified Auth users.
revoke all on function public.kk_issue(uuid),public.kk_verify(uuid,text),public.kk_snapshot(uuid,text),public.kk_manage_residency(uuid,jsonb),public.kk_alert_status(uuid,uuid,text),public.kk_declare(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.kk_issue(uuid),public.kk_verify(uuid,text),public.kk_snapshot(uuid,text),public.kk_manage_residency(uuid,jsonb),public.kk_alert_status(uuid,uuid,text),public.kk_declare(uuid,jsonb) to service_role;
do $$ declare t text; begin foreach t in array array['access_events','security_alerts','residencies','holiday_declarations','gate_terminals'] loop if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if; end loop; end $$;
