-- handle_new_user is a trigger function only; it must never be directly
-- callable via PostgREST RPC by anyone. Trigger firing is unaffected by
-- revoking EXECUTE (the trigger invokes it internally, not via role grant).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- auth_has_role / current_staff_id: harmless for anon (return false/null),
-- but anon has no legitimate reason to call them directly — restrict to
-- authenticated users only.
revoke execute on function public.auth_has_role(text) from anon;
revoke execute on function public.current_staff_id() from anon;

-- assign_role already self-checks for the principal role internally, but
-- anon should not even reach that check.
revoke execute on function public.assign_role(uuid, text) from anon;
