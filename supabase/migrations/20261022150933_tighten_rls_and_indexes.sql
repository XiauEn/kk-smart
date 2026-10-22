-- The role table already permits users to read only their own role. This lookup
-- therefore needs no SECURITY DEFINER privilege or anonymous execution.
create or replace function public.is_management() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.account_roles where auth_user_id=(select auth.uid()) and role='management')
$$;
revoke all on function public.is_management() from public, anon, authenticated;
grant execute on function public.is_management() to authenticated, service_role;
alter policy students_read on public.students using(auth_user_id=(select auth.uid()) or (select public.is_management()));
alter policy residencies_read on public.residencies using((select public.is_management()) or exists(select 1 from public.students s where s.id=residencies.student_id and s.auth_user_id=(select auth.uid())));
alter policy roles_self on public.account_roles using(auth_user_id=(select auth.uid()));
alter policy terminals_self on public.gate_terminals using(auth_user_id=(select auth.uid()) or (select public.is_management()));
alter policy events_management on public.access_events using((select public.is_management()));
alter policy alerts_management on public.security_alerts using((select public.is_management()));
alter policy holidays_read on public.holiday_declarations using((select public.is_management()) or exists(select 1 from public.students s where s.id=holiday_declarations.student_id and s.auth_user_id=(select auth.uid())));
alter policy audit_management on public.audit_log using((select public.is_management()));
create index approved_permissions_approver on public.approved_permissions(approved_by);
create index approved_permissions_block on public.approved_permissions(block_id);
create index audit_log_actor on public.audit_log(actor_id);
create index gate_terminals_block on public.gate_terminals(block_id);
create index offline_demo_events_terminal on public.offline_demo_events(terminal_id);
create index qr_credentials_student_issued on public.qr_credentials(student_id,issued_at desc);
create index residencies_block on public.residencies(block_id);
create index security_alerts_block_time on public.security_alerts(block_id,timestamp desc);
