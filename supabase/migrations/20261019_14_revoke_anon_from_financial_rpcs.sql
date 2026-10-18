-- Supabase grants EXECUTE directly to anon/authenticated on functions
-- created in the public schema (not just via the PUBLIC role) — revoking
-- from PUBLIC alone, as the previous migration did, was not enough.
revoke execute on function public.generate_monthly_fee_schedules(uuid, date) from anon;
revoke execute on function public.record_payment(uuid, text, bigint, jsonb, text, text) from anon;
revoke execute on function public.issue_refund(uuid, text, text) from anon;
