alter table public.fee_structures enable row level security;
alter table public.fee_schedules enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.refunds enable row level security;
alter table public.refund_allocations enable row level security;

-- fee_structures / fee_schedules ---------------------------------------------
-- principal/accountant: full. teacher: read-only, scoped to their own
-- roster (sections they hold an active subject assignment for). Parent
-- read access arrives in M8 once verified links exist.
create policy fee_structures_select on public.fee_structures
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or exists (
      select 1 from public.teacher_subject_assignments tsa
      join public.sections sec on sec.id = tsa.section_id
      where sec.class_id = fee_structures.class_id
        and tsa.teacher_staff_id = public.current_staff_id()
        and tsa.effective_to is null
    )
  );
create policy fee_structures_write on public.fee_structures
  for all using (public.auth_has_role('principal') or public.auth_has_role('accountant'))
  with check (public.auth_has_role('principal') or public.auth_has_role('accountant'));

create policy fee_schedules_select on public.fee_schedules
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or exists (
      select 1 from public.teacher_subject_assignments tsa
      join public.students st on st.current_section_id = tsa.section_id
      where st.id = fee_schedules.student_id
        and tsa.teacher_staff_id = public.current_staff_id()
        and tsa.effective_to is null
    )
  );
-- Writes only via generate_monthly_fee_schedules (security definer) — no
-- direct insert/update/delete policy for any role.

-- payments / payment_allocations / refunds / refund_allocations -------------
-- Read: principal/accountant full. No role gets a direct write policy —
-- record_payment / issue_refund (security definer) are the only writers.
create policy payments_select on public.payments
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));

create policy payment_allocations_select on public.payment_allocations
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));

create policy refunds_select on public.refunds
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));

create policy refund_allocations_select on public.refund_allocations
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));

-- Lock down direct EXECUTE on the new functions the same way as earlier
-- RPCs: authenticated only (self-checked internally), never anon/PUBLIC.
revoke execute on function public.recompute_fee_schedule_status(uuid) from public, anon, authenticated;
revoke execute on function public.generate_monthly_fee_schedules(uuid, date) from public;
grant execute on function public.generate_monthly_fee_schedules(uuid, date) to authenticated;
revoke execute on function public.record_payment(uuid, text, bigint, jsonb, text, text) from public;
grant execute on function public.record_payment(uuid, text, bigint, jsonb, text, text) to authenticated;
revoke execute on function public.issue_refund(uuid, text, text) from public;
grant execute on function public.issue_refund(uuid, text, text) to authenticated;
