-- Fixed-monthly payroll — deliberately thin (no amortized loans, no leave
-- pro-ration) to match the "fixed monthly salary" requirement.

create table public.staff_salaries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id),
  monthly_amount_minor bigint not null check (monthly_amount_minor > 0),
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now()
);

-- At most one active (current) salary per staff member. A raise closes this
-- row and opens a new one — never an in-place update — preserving payroll
-- history.
create unique index staff_salaries_one_active
  on public.staff_salaries (staff_id)
  where effective_to is null;

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  generated_by uuid not null references public.staff (id),
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs (id),
  staff_id uuid not null references public.staff (id),
  base_amount_minor bigint not null check (base_amount_minor >= 0),
  adjustments_total_minor bigint not null default 0,
  net_amount_minor bigint not null,
  paid_at timestamptz,
  payment_method text check (payment_method in ('cash', 'upi', 'bank_transfer')),
  created_at timestamptz not null default now(),
  unique (payroll_run_id, staff_id)
);

-- One-off deduction/advance/bonus tagged to a specific payroll run. Flat
-- table, no recurring-deduction engine or amortization schedule —
-- intentionally thin per the "fixed monthly" requirement.
create table public.salary_adjustments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id),
  payroll_run_id uuid not null references public.payroll_runs (id),
  kind text not null check (kind in ('deduction', 'advance', 'bonus')),
  amount_minor bigint not null check (amount_minor > 0),
  reason text not null,
  created_by uuid not null references public.staff (id),
  created_at timestamptz not null default now()
);

-- Generates one draft payslip per staff member with a currently-active
-- salary, net = base (no adjustments yet — those are added afterward via
-- add_salary_adjustment, which recomputes the net). Re-running for the
-- same period_month is a no-op thanks to the unique constraint on
-- payroll_runs.period_month failing loudly rather than creating a second run.
create function public.generate_payroll_run(p_period_month date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_staff_id uuid;
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may generate payroll';
  end if;

  v_staff_id := public.current_staff_id();

  insert into public.payroll_runs (period_month, generated_by)
  values (date_trunc('month', p_period_month)::date, v_staff_id)
  returning id into v_run_id;

  insert into public.payslips (payroll_run_id, staff_id, base_amount_minor, net_amount_minor)
  select v_run_id, ss.staff_id, ss.monthly_amount_minor, ss.monthly_amount_minor
  from public.staff_salaries ss
  where ss.effective_to is null;

  return v_run_id;
end;
$$;

-- Adds one adjustment to a draft run and recomputes that staff member's
-- payslip net in the same transaction, so the two can never drift apart.
create function public.add_salary_adjustment(
  p_payroll_run_id uuid,
  p_staff_id uuid,
  p_kind text,
  p_amount_minor bigint,
  p_reason text
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

  select status into v_run_status from public.payroll_runs where id = p_payroll_run_id;
  if v_run_status is null then
    raise exception 'payroll run not found';
  end if;
  if v_run_status <> 'draft' then
    raise exception 'cannot adjust a % payroll run — corrections require a new run', v_run_status;
  end if;

  v_staff_id := public.current_staff_id();

  insert into public.salary_adjustments (staff_id, payroll_run_id, kind, amount_minor, reason, created_by)
  values (p_staff_id, p_payroll_run_id, p_kind, p_amount_minor, p_reason, v_staff_id);

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

-- Locks the run: no further adjustments, no further base-salary drift.
-- Corrections after this point are a new adjustment in a LATER run, never
-- an edit here.
create function public.finalize_payroll_run(p_payroll_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may finalize payroll';
  end if;

  select status into v_status from public.payroll_runs where id = p_payroll_run_id;
  if v_status is null then
    raise exception 'payroll run not found';
  end if;
  if v_status <> 'draft' then
    raise exception 'payroll run is already %', v_status;
  end if;

  update public.payroll_runs
  set status = 'finalized', finalized_at = now()
  where id = p_payroll_run_id;
end;
$$;

-- "Calculated" and "disbursed" are deliberately distinct states — marking
-- paid only records that cash/UPI/bank transfer actually happened, on an
-- already-finalized payslip.
create function public.mark_payslip_paid(p_payslip_id uuid, p_payment_method text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_status text;
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may mark a payslip paid';
  end if;

  select pr.status into v_run_status
  from public.payslips p join public.payroll_runs pr on pr.id = p.payroll_run_id
  where p.id = p_payslip_id;

  if v_run_status is distinct from 'finalized' then
    raise exception 'payslip must belong to a finalized run';
  end if;

  update public.payslips
  set paid_at = now(), payment_method = p_payment_method
  where id = p_payslip_id;
end;
$$;
