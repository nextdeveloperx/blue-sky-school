-- Closes a gap left open since migration 18/19: the comment on
-- marks_write_teacher said "M7 will additionally gate writes on the
-- student's result not yet being approved/published once the results table
-- exists" — but migration 19 (results) never actually added that gate, so a
-- teacher could still edit a mark after the principal had approved or
-- published the result built from it.
--
-- Rule: a teacher can write marks for a student+exam_term UNTIL the
-- principal has approved (or published) that student's result for that
-- term. Once approved/published, only the principal can touch marks
-- (marks_write_principal, unaffected by this change) — matching
-- reopen_for_correction, which is already the only way back to 'draft'.
-- Before compute_results has ever run for a student, or after a reopen,
-- there is no 'approved'/'published' row, so the teacher's normal write
-- access is untouched.
--
-- ALTER POLICY updates the expression in place; no DROP/CREATE needed, and
-- principal's policy (marks_write_principal) is a separate policy, not
-- touched here.
--
-- Rollback: re-run ALTER POLICY with the original (pre-this-migration)
-- USING/WITH CHECK expression from migration 20261019_18_rls_marks.sql.
alter policy marks_write_teacher on public.marks
  using (
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
