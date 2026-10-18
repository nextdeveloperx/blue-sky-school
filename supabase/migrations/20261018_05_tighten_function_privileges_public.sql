-- Postgres grants EXECUTE to PUBLIC by default on function creation; revoking
-- from `anon` alone isn't enough since `authenticated`/`anon` both still
-- inherit through PUBLIC. Revoke from PUBLIC and re-grant explicitly only to
-- authenticated (the Supabase advisor's anon_security_definer_function_executable
-- check flags exactly this gap).
revoke execute on function public.auth_has_role(text) from public;
revoke execute on function public.current_staff_id() from public;
revoke execute on function public.assign_role(uuid, text) from public;

grant execute on function public.auth_has_role(text) to authenticated;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.assign_role(uuid, text) to authenticated;
