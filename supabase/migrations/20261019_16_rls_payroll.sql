alter table public.staff_salaries enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;
alter table public.salary_adjustments enable row level security;

-- staff_salaries: principal/accountant full (direct writes — this is a
-- "current assignment" record, not an append-only ledger; a raise closes
-- the old row and opens a new one via two direct writes from the UI).
create policy staff_salaries_select on public.staff_salaries
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));
create policy staff_salaries_write on public.staff_salaries
  for all using (public.auth_has_role('principal') or public.auth_has_role('accountant'))
  with check (public.auth_has_role('principal') or public.auth_has_role('accountant'));

-- payroll_runs / payslips / salary_adjustments: read principal/accountant
-- full; a staff member (including teacher) may read only their OWN
-- payslips — harmless self-service. No direct insert/update/delete policy
-- for anyone — generate_payroll_run / add_salary_adjustment /
-- finalize_payroll_run / mark_payslip_paid are the only writers.
create policy payroll_runs_select on public.payroll_runs
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));

create policy payslips_select on public.payslips
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or staff_id = public.current_staff_id()
  );

create policy salary_adjustments_select on public.salary_adjustments
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or staff_id = public.current_staff_id()
  );

revoke execute on function public.generate_payroll_run(date) from public, anon;
grant execute on function public.generate_payroll_run(date) to authenticated;
revoke execute on function public.add_salary_adjustment(uuid, uuid, text, bigint, text) from public, anon;
grant execute on function public.add_salary_adjustment(uuid, uuid, text, bigint, text) to authenticated;
revoke execute on function public.finalize_payroll_run(uuid) from public, anon;
grant execute on function public.finalize_payroll_run(uuid) to authenticated;
revoke execute on function public.mark_payslip_paid(uuid, text) from public, anon;
grant execute on function public.mark_payslip_paid(uuid, text) to authenticated;
