-- Security remediation: prevent a payment from being refunded twice.
--
-- Schema change: a UNIQUE constraint on refunds.original_payment_id. Current
-- design only ever issues one (full) refund per original payment, so this
-- is the correct cardinality — and it is the actual safety net: even if a
-- future code path forgets to take the advisory lock below, or a second
-- call races past the pre-check, this constraint makes a second INSERT
-- physically impossible to commit, regardless of timing.
--
-- Rollback: `alter table public.refunds drop constraint refunds_original_payment_id_key;`
-- Safe to roll back at any time — it only ever restricts future writes, it
-- cannot have caused any existing row to violate it (the function has only
-- ever inserted one refund per payment; this migration doesn't touch data).
alter table public.refunds
  add constraint refunds_original_payment_id_key unique (original_payment_id);

-- Concurrency-safe issue_refund: a transaction-scoped advisory lock keyed on
-- the payment id serializes any two concurrent refund attempts for the SAME
-- payment (two different payments never contend with each other). Under
-- Postgres's default READ COMMITTED isolation, a plain "select ... where
-- not exists" check-then-insert is a TOCTOU race — two concurrent
-- transactions can both see "no refund yet" before either commits. The
-- advisory lock closes that window: the second caller blocks until the
-- first transaction finishes, then re-checks and gets a clean, friendly
-- rejection instead of a race. pg_advisory_xact_lock auto-releases at
-- transaction end (commit OR rollback) — no manual unlock needed, and it
-- is safe even if an earlier exception aborts the transaction.
--
-- The UNIQUE constraint above remains a backstop even if this function is
-- ever bypassed; the raise-on-unique_violation handler turns that rare
-- case into the same friendly error instead of a raw constraint message.
--
-- Idempotency-key handling (the existing early-return for a retried call
-- with the SAME key) is unchanged. Audit logging (the refunds_audit
-- trigger from M10) still fires on the single successful INSERT — nothing
-- about the audit trail changes.
create or replace function public.issue_refund(
  p_payment_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns table (refund_receipt_number text, refund_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.payments%rowtype;
  v_staff_id uuid;
  v_refund_payment_id uuid;
  v_receipt text;
  v_refund_id uuid;
  v_alloc public.payment_allocations%rowtype;
  v_existing_payment_id uuid;
  v_existing_receipt text;
  v_existing_refund_id uuid;
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may issue refunds';
  end if;

  select p.id, p.receipt_number into v_existing_payment_id, v_existing_receipt
  from public.payments p where p.idempotency_key = p_idempotency_key;

  if v_existing_payment_id is not null then
    select r.id into v_existing_refund_id from public.refunds r
    where r.refund_payment_id = v_existing_payment_id;
    return query select v_existing_receipt, v_existing_refund_id;
    return;
  end if;

  select * into v_original from public.payments where id = p_payment_id and is_refund = false;
  if v_original.id is null then
    raise exception 'original payment not found or is itself a refund';
  end if;

  v_staff_id := public.current_staff_id();
  if v_staff_id is null then
    raise exception 'only staff may issue refunds';
  end if;

  -- Serialize concurrent refund attempts for this specific payment. Blocks
  -- (does not fail) if another transaction is mid-refund for the same
  -- payment id; released automatically at end of transaction either way.
  perform pg_advisory_xact_lock(hashtextextended(p_payment_id::text, 0));

  if exists (select 1 from public.refunds where original_payment_id = p_payment_id) then
    raise exception 'this payment has already been refunded';
  end if;

  v_receipt := 'RCPT-' || to_char(current_date, 'YYYY') || '-'
    || lpad(nextval('public.receipt_number_seq')::text, 5, '0');

  insert into public.payments
    (student_id, method, amount_minor, received_by, receipt_number, idempotency_key,
     reference_note, is_refund)
  values
    (v_original.student_id, v_original.method, v_original.amount_minor, v_staff_id,
     v_receipt, p_idempotency_key, p_reason, true)
  returning id into v_refund_payment_id;

  begin
    insert into public.refunds (original_payment_id, refund_payment_id, reason, processed_by)
    values (p_payment_id, v_refund_payment_id, p_reason, v_staff_id)
    returning id into v_refund_id;
  exception when unique_violation then
    -- Backstop path: should be unreachable in practice because of the
    -- advisory lock above. Re-raising aborts the whole transaction, which
    -- also undoes the payments insert a few lines up — no orphan row.
    raise exception 'this payment has already been refunded (concurrent request detected)';
  end;

  for v_alloc in select * from public.payment_allocations where payment_id = p_payment_id loop
    insert into public.refund_allocations (refund_id, fee_schedule_id, amount_minor)
    values (v_refund_id, v_alloc.fee_schedule_id, v_alloc.allocated_amount_minor);

    perform public.recompute_fee_schedule_status(v_alloc.fee_schedule_id);
  end loop;

  return query select v_receipt, v_refund_id;
end;
$$;
