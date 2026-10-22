-- DESTRUCTIVE: run only against the dedicated fictional competition project.
-- Preserves Auth accounts, student/account links, and terminal registration.
-- After this completes, run demo.sql again to restore permissions and activity.
begin;
delete from public.offline_demo_events;
delete from public.audit_log;
delete from public.security_alerts;
delete from public.access_events;
delete from public.qr_credentials;
delete from public.approved_permissions;
delete from public.holiday_declarations;
delete from public.residencies;
commit;
