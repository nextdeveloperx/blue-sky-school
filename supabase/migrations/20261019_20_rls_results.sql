alter table public.results enable row level security;
alter table public.results_audit enable row level security;

-- results: principal/accountant read any status; teacher read only for
-- students in their own assignments (any status — they need to see draft
-- totals too). Parent read (published-only) arrives in M8.
create policy results_select on public.results
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or exists (
      select 1 from public.teacher_subject_assignments tsa
      join public.students st on st.current_section_id = tsa.section_id
      where st.id = results.student_id
        and tsa.teacher_staff_id = public.current_staff_id()
        and tsa.effective_to is null
    )
  );
-- No insert/update/delete policy for anyone — compute_results /
-- approve_results / reject_results / publish_results / reopen_for_correction
-- (all security definer, principal-gated) are the only writers.

create policy results_audit_select on public.results_audit
  for select using (public.auth_has_role('principal'));

-- Tighten marks writes: a per-student lock, not a blanket per-term freeze —
-- a teacher (or principal) cannot write a mark once that student's result
-- for the term is approved or published. Replaces the M6 policies with the
-- same assignment check plus this additional condition.
drop policy marks_write_teacher on public.marks;
drop policy marks_write_principal on public.marks;

create policy marks_write_teacher on public.marks
  for all using (
    exists (
      select 1 from public.teacher_subject_assignments tsa
      where tsa.section_id = marks.section_id
        and tsa.subject_id = marks.subject_id
        and tsa.teacher_staff_id = public.current_staff_id()
        and tsa.effective_to is null
    )
    and not exists (
      select 1 from public.results r
      where r.student_id = marks.student_id
        and r.exam_term_id = marks.exam_term_id
        and r.status in ('approved', 'published')
    )
  )
  with check (
    exists (
      select 1 from public.teacher_subject_assignments tsa
      where tsa.section_id = marks.section_id
        and tsa.subject_id = marks.subject_id
        and tsa.teacher_staff_id = public.current_staff_id()
        and tsa.effective_to is null
    )
    and not exists (
      select 1 from public.results r
      where r.student_id = marks.student_id
        and r.exam_term_id = marks.exam_term_id
        and r.status in ('approved', 'published')
    )
  );

-- Principal is NOT exempt from the lock either — the sanctioned way to
-- unlock a locked result is reopen_for_correction, never a direct edit.
create policy marks_write_principal on public.marks
  for all using (
    public.auth_has_role('principal')
    and not exists (
      select 1 from public.results r
      where r.student_id = marks.student_id
        and r.exam_term_id = marks.exam_term_id
        and r.status in ('approved', 'published')
    )
  )
  with check (
    public.auth_has_role('principal')
    and not exists (
      select 1 from public.results r
      where r.student_id = marks.student_id
        and r.exam_term_id = marks.exam_term_id
        and r.status in ('approved', 'published')
    )
  );

revoke execute on function public.compute_results(uuid) from public, anon;
grant execute on function public.compute_results(uuid) to authenticated;
revoke execute on function public.approve_results(uuid[]) from public, anon;
grant execute on function public.approve_results(uuid[]) to authenticated;
revoke execute on function public.reject_results(uuid[], text) from public, anon;
grant execute on function public.reject_results(uuid[], text) to authenticated;
revoke execute on function public.publish_results(uuid[]) from public, anon;
grant execute on function public.publish_results(uuid[]) to authenticated;
revoke execute on function public.reopen_for_correction(uuid, text) from public, anon;
grant execute on function public.reopen_for_correction(uuid, text) to authenticated;
