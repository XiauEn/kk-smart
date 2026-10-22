-- Server-only configuration; this schema is not exposed through the Data API.
create schema if not exists kk_internal;
revoke all on schema kk_internal from public, anon, authenticated;
grant usage on schema kk_internal to service_role;
create table kk_internal.settings (key text primary key, value jsonb not null);
create table kk_internal.setup_challenges (
 credential_hash text primary key check(credential_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 used_at timestamptz
);
alter table kk_internal.settings enable row level security;
alter table kk_internal.setup_challenges enable row level security;
revoke all on kk_internal.settings, kk_internal.setup_challenges from public, anon, authenticated;
grant select, insert, update, delete on kk_internal.settings, kk_internal.setup_challenges to service_role;
insert into kk_internal.settings(key,value) values ('demo_controls_enabled','false'::jsonb);

create function public.kk_demo_controls_enabled(p_actor uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.gate_terminals t join public.account_roles r on r.auth_user_id=t.auth_user_id
 where t.auth_user_id=p_actor and not t.revoked and r.role='terminal')
 and exists(select 1 from kk_internal.settings where key='demo_controls_enabled' and value='true'::jsonb)
$$;
create function public.kk_consume_setup(p_hash text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 update kk_internal.setup_challenges set used_at=clock_timestamp()
 where credential_hash=p_hash and used_at is null and expires_at>clock_timestamp();
 return found;
end $$;
revoke all on function public.kk_demo_controls_enabled(uuid), public.kk_consume_setup(text) from public, anon, authenticated;
grant execute on function public.kk_demo_controls_enabled(uuid), public.kk_consume_setup(text) to service_role;
