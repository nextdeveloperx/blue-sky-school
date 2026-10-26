-- Extends the existing expenses module (migration 24) for the Principal's
-- Daily School Expenses screen, instead of creating a parallel table. Adds
-- the fields the form needs, a safe correction/void workflow in place of
-- hard delete (matching how this schema treats every other financial
-- ledger — payments/refunds/salary_adjustments never allow a DELETE, a
-- correction is a new row or a status change), and audit coverage via the
-- same generic trigger already used for payments/refunds/payroll_runs.
--
-- Production currently has pre-existing expenses rows (11, from an earlier
-- test-data seeding session) — the two new NOT NULL columns are backfilled
-- below before the constraint is added, so this is safe to run as-is.

-- 1. New columns -------------------------------------------------------

alter table public.expenses add column title text;
update public.expenses set title = coalesce(nullif(description, ''), 'Expense') where title is null;
alter table public.expenses alter column title set not null;

alter table public.expenses add column payment_method text;
update public.expenses set payment_method = 'other' where payment_method is null;
alter table public.expenses alter column payment_method set not null;
alter table public.expenses
  add constraint expenses_payment_method_check
  check (payment_method in ('cash', 'upi', 'bank_transfer', 'cheque', 'other'));

alter table public.expenses add column vendor text;

alter table public.expenses add column updated_by uuid references public.staff (id);
alter table public.expenses add column updated_at timestamptz;

-- Void instead of delete: voided_at IS NULL means "active" everywhere a
-- query needs to filter them out. No restore RPC for now — undoing a void
-- is a principal decision to make deliberately, not a one-click toggle;
-- the voided row (and who/why) stays fully visible via audit_log either way.
alter table public.expenses add column voided_at timestamptz;
alter table public.expenses add column voided_by uuid references public.staff (id);
alter table public.expenses add column void_reason text;

-- 2. Seed the category list the form expects, without touching any
--    existing category used by the 11 pre-existing rows (added by name,
--    so this is a pure addition — no renames, no deletes).
insert into public.expense_categories (name) values
  ('Electricity'),
  ('Water'),
  ('School Supplies'),
  ('Cleaning'),
  ('Repairs & Maintenance'),
  ('Transportation'),
  ('Staff Welfare'),
  ('Events'),
  ('Internet/Telephone'),
  ('Other')
on conflict (name) do nothing;

-- 3. Tighten RLS: replace the old blanket "for all" policy (which
--    implicitly included DELETE) with explicit insert/update/select
--    policies and NO delete policy at all — mirroring payments/refunds.
--    With RLS enabled and no DELETE policy, DELETE is denied to every
--    role (service_role bypasses RLS entirely and is never used from the
--    client, per this project's existing convention).
drop policy expenses_write on public.expenses;

create policy expenses_insert on public.expenses
  for insert
  with check (public.auth_has_role('principal') or public.auth_has_role('accountant'));

create policy expenses_update on public.expenses
  for update
  using (public.auth_has_role('principal') or public.auth_has_role('accountant'))
  with check (public.auth_has_role('principal') or public.auth_has_role('accountant'));

-- 4. Audit trail, same pattern as migration 26 (payments/refunds/payroll_runs).
--    INSERT + UPDATE only, matching the DELETE being blocked at the RLS layer
--    above — there is never a delete event to log.
create trigger expenses_audit after insert or update on public.expenses
  for each row execute function public.audit_row_change();
