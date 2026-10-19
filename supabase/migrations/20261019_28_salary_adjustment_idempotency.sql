-- Security remediation (batch 1, follow-up): the original batch gave
-- add_salary_adjustment only a client-side pending-state guard — unlike
-- record_payment/issue_refund, it had no server-side idempotency key, so a
-- direct API retry or a second browser tab could still double-apply a
-- deduction/bonus (each row is summed into the payslip's net, so a
-- duplicate row directly doubles that adjustment's effect).
--
-- Schema change: add idempotency_key (unique) to salary_adjustments,
-- exactly mirroring the payments/refunds pattern already in place.
--
-- Rollback: `alter table public.salary_adjustments drop column idempotency_key;`
-- (the unique constraint is dropped automatically with the column). Safe at
-- any time — production currently has zero salary_adjustments rows.
alter table public.salary_adjustments add column idempotency_key text;
alter table public.salary_adjustments
  add constraint salary_adjustments_idempotency_key_key unique (idempotency_key);

-- IMPORTANT: adding a parameter is NOT a valid CREATE OR REPLACE target in
-- Postgres — the old 5-argument function and a hypothetical new 6-argument
-- one are different overloads by signature, so CREATE OR REPLACE would
-- silently create a second overload and leave the old (non-idempotent) one
-- live and callable. The old one must be dropped explicitly first.
--
-- Rollback for this half: re-create the original 5-arg function body (see
-- migration 20261019_15_payroll.sql) and drop the 6-arg one.
drop function public.add_salary_adjustment(uuid, uuid, text, bigint, text);

create function public.add_salary_adjustment(
  p_payroll_run_id uuid,
  p_staff_id uuid,
  p_kind text,
  p_amount_minor bigint,
  p_reason text,
  p_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_status text;
  v_staff_id uuid;
  v_base bigint;
  v_adjustments bigint;
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may add salary adjustments';
  end if;

  -- Idempotent replay: a retried call with the SAME key is a clean no-op —
  -- the adjustment is already applied and the payslip already reflects it.
  if exists (select 1 from public.salary_adjustments where idempotency_key = p_idempotency_key) then
    return;
  end if;

  select status into v_run_status from public.payroll_runs where id = p_payroll_run_id;
  if v_run_status is null then
    raise exception 'payroll run not found';
  end if;
  if v_run_status <> 'draft' then
    raise exception 'cannot adjust a % payroll run — corrections require a new run', v_run_status;
  end if;

  v_staff_id := public.current_staff_id();

  insert into public.salary_adjustments
    (staff_id, payroll_run_id, kind, amount_minor, reason, created_by, idempotency_key)
  values (p_staff_id, p_payroll_run_id, p_kind, p_amount_minor, p_reason, v_staff_id, p_idempotency_key);

  select base_amount_minor into v_base from public.payslips
  where payroll_run_id = p_payroll_run_id and staff_id = p_staff_id;

  select coalesce(sum(case when kind = 'bonus' then amount_minor else -amount_minor end), 0)
  into v_adjustments
  from public.salary_adjustments
  where payroll_run_id = p_payroll_run_id and staff_id = p_staff_id;

  update public.payslips
  set adjustments_total_minor = v_adjustments,
      net_amount_minor = v_base + v_adjustments
  where payroll_run_id = p_payroll_run_id and staff_id = p_staff_id;
end;
$$;

-- A freshly CREATEd function gets default PUBLIC-visible grants — this is
-- NOT a replace, so the earlier revoke/grant from migration 16 does not
-- carry over. Re-apply the same pattern as every other financial RPC in
-- this system: authenticated only (self-checked internally), never
-- anon/PUBLIC. Verified empirically (see remediation report) that this
-- leaves exactly the same grant shape as before: postgres/service_role
-- (always present, privileged backend roles) + authenticated, no anon.
revoke execute on function public.add_salary_adjustment(uuid, uuid, text, bigint, text, text) from public, anon;
grant execute on function public.add_salary_adjustment(uuid, uuid, text, bigint, text, text) to authenticated;
