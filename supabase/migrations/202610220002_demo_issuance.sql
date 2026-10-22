-- Explicit competition-only path. The Edge Function additionally requires DEMO_CONTROLS_ENABLED.
create function public.kk_demo_issue(p_actor uuid,p_student uuid,p_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=clock_timestamp(); begin
 if not exists(select 1 from public.gate_terminals t join public.account_roles r on r.auth_user_id=t.auth_user_id where t.auth_user_id=p_actor and not t.revoked and r.role='terminal') then raise exception 'Authorised terminal required'; end if;
 if p_student not in ('00000000-0000-4000-8000-000000000001'::uuid,'00000000-0000-4000-8000-000000000002'::uuid,'00000000-0000-4000-8000-000000000003'::uuid,'00000000-0000-4000-8000-000000000004'::uuid) or p_hash!~'^[a-f0-9]{64}$' then raise exception 'Invalid demo identity'; end if;
 insert into public.qr_credentials(student_id,credential_hash,issued_at,expires_at) values(p_student,p_hash,v_now,v_now+interval '15 seconds');return true;
end $$;
revoke all on function public.kk_demo_issue(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.kk_demo_issue(uuid,uuid,text) to service_role;
