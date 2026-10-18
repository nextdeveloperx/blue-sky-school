-- Monthly fees, manual payments (cash/upi/bank_transfer only), and refunds.
-- Money is integer minor units (paise). payments/payment_allocations/
-- refunds/refund_allocations are an append-only ledger: no insert/update/
-- delete RLS policy is ever granted on them to any role (not even principal)
-- — the ONLY way they change is through record_payment/issue_refund below,
-- which run as security-definer and are the sole writers.

create sequence public.receipt_number_seq;

create table public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id),
  class_id uuid not null references public.classes (id),
  name text not null,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  unique (academic_year_id, class_id, name)
);

create table public.fee_schedules (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  fee_structure_id uuid not null references public.fee_structures (id),
  period_month date not null,
  amount_due_minor bigint not null check (amount_due_minor > 0),
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid')),
  created_at timestamptz not null default now(),
  unique (student_id, fee_structure_id, period_month)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  method text not null check (method in ('cash', 'upi', 'bank_transfer')),
  amount_minor bigint not null check (amount_minor > 0),
  received_at timestamptz not null default now(),
  received_by uuid not null references public.staff (id),
  receipt_number text not null unique,
  idempotency_key text not null unique,
  is_refund boolean not null default false,
  reference_note text,
  created_at timestamptz not null default now()
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  fee_schedule_id uuid not null references public.fee_schedules (id),
  allocated_amount_minor bigint not null check (allocated_amount_minor > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, fee_schedule_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  original_payment_id uuid not null references public.payments (id),
  refund_payment_id uuid not null references public.payments (id),
  reason text not null,
  processed_by uuid not null references public.staff (id),
  created_at timestamptz not null default now()
);

create table public.refund_allocations (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.refunds (id) on delete cascade,
  fee_schedule_id uuid not null references public.fee_schedules (id),
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now()
);

-- Recomputes one fee_schedule's status from its allocations minus any
-- refund_allocations against it. Called after every allocation/refund
-- change inside the RPCs below — never left to a trigger, since one
-- record_payment call can touch several schedules in one transaction.
create function public.recompute_fee_schedule_status(p_fee_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due bigint;
  v_paid bigint;
begin
  select amount_due_minor into v_due from public.fee_schedules where id = p_fee_schedule_id;

  select coalesce(sum(pa.allocated_amount_minor), 0) - coalesce((
    select sum(ra.amount_minor) from public.refund_allocations ra
    where ra.fee_schedule_id = p_fee_schedule_id
  ), 0)
  into v_paid
  from public.payment_allocations pa
  where pa.fee_schedule_id = p_fee_schedule_id;

  update public.fee_schedules
  set status = case
    when v_paid <= 0 then 'pending'
    when v_paid < v_due then 'partial'
    else 'paid'
  end
  where id = p_fee_schedule_id;
end;
$$;

-- Generates one fee_schedules row per active student per applicable
-- fee_structure for the given month. Idempotent via the unique constraint
-- (on conflict do nothing) — safe to re-run mid-month for new admissions.
create function public.generate_monthly_fee_schedules(p_academic_year_id uuid, p_period_month date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int;
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may generate fee schedules';
  end if;

  insert into public.fee_schedules (student_id, fee_structure_id, period_month, amount_due_minor)
  select s.id, fs.id, date_trunc('month', p_period_month)::date, fs.amount_minor
  from public.students s
  join public.sections sec on sec.id = s.current_section_id
  join public.fee_structures fs
    on fs.class_id = sec.class_id and fs.academic_year_id = p_academic_year_id
  where s.academic_year_id = p_academic_year_id and s.status = 'active'
  on conflict (student_id, fee_structure_id, period_month) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- Records one payment, possibly split across several fee_schedules
-- (partial payments / paying off multiple months at once). p_allocations
-- is a jsonb array of {"fee_schedule_id": uuid, "amount_minor": bigint}.
-- Idempotency: checks idempotency_key FIRST and returns the existing
-- receipt untouched if already used — makes a double-click or retried
-- request a safe no-op instead of a duplicate charge.
create function public.record_payment(
  p_student_id uuid,
  p_method text,
  p_amount_minor bigint,
  p_allocations jsonb,
  p_reference_note text,
  p_idempotency_key text
)
returns table (receipt_number text, payment_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_existing_receipt text;
  v_payment_id uuid;
  v_receipt text;
  v_staff_id uuid;
  v_alloc jsonb;
  v_sum bigint := 0;
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may record payments';
  end if;

  select p.id, p.receipt_number into v_existing_id, v_existing_receipt
  from public.payments p where p.idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    return query select v_existing_receipt, v_existing_id;
    return;
  end if;

  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_sum := v_sum + (v_alloc ->> 'amount_minor')::bigint;
  end loop;

  if v_sum <> p_amount_minor then
    raise exception 'allocations (%) do not sum to payment amount (%)', v_sum, p_amount_minor;
  end if;

  v_staff_id := public.current_staff_id();
  if v_staff_id is null then
    raise exception 'only staff may record payments';
  end if;

  v_receipt := 'RCPT-' || to_char(current_date, 'YYYY') || '-'
    || lpad(nextval('public.receipt_number_seq')::text, 5, '0');

  insert into public.payments
    (student_id, method, amount_minor, received_by, receipt_number, idempotency_key, reference_note)
  values
    (p_student_id, p_method, p_amount_minor, v_staff_id, v_receipt, p_idempotency_key, p_reference_note)
  returning id into v_payment_id;

  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    insert into public.payment_allocations (payment_id, fee_schedule_id, allocated_amount_minor)
    values (
      v_payment_id,
      (v_alloc ->> 'fee_schedule_id')::uuid,
      (v_alloc ->> 'amount_minor')::bigint
    );

    perform public.recompute_fee_schedule_status((v_alloc ->> 'fee_schedule_id')::uuid);
  end loop;

  return query select v_receipt, v_payment_id;
end;
$$;

-- Full refund of one existing (non-refund) payment. Never mutates or
-- deletes the original payment row — inserts a new payments row
-- (is_refund = true) and compensating refund_allocations, then recomputes
-- each affected fee_schedule's status.
create function public.issue_refund(
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

  v_receipt := 'RCPT-' || to_char(current_date, 'YYYY') || '-'
    || lpad(nextval('public.receipt_number_seq')::text, 5, '0');

  insert into public.payments
    (student_id, method, amount_minor, received_by, receipt_number, idempotency_key,
     reference_note, is_refund)
  values
    (v_original.student_id, v_original.method, v_original.amount_minor, v_staff_id,
     v_receipt, p_idempotency_key, p_reason, true)
  returning id into v_refund_payment_id;

  insert into public.refunds (original_payment_id, refund_payment_id, reason, processed_by)
  values (p_payment_id, v_refund_payment_id, p_reason, v_staff_id)
  returning id into v_refund_id;

  for v_alloc in select * from public.payment_allocations where payment_id = p_payment_id loop
    insert into public.refund_allocations (refund_id, fee_schedule_id, amount_minor)
    values (v_refund_id, v_alloc.fee_schedule_id, v_alloc.allocated_amount_minor);

    perform public.recompute_fee_schedule_status(v_alloc.fee_schedule_id);
  end loop;

  return query select v_receipt, v_refund_id;
end;
$$;
