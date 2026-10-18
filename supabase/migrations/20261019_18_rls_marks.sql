alter table public.exam_terms enable row level security;
alter table public.grade_scale enable row level security;
alter table public.marks enable row level security;
alter table public.marks_audit enable row level security;

-- exam_terms / grade_scale: any signed-in app user may read; principal only
-- may write.
create policy exam_terms_select on public.exam_terms
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or public.auth_has_role('teacher') or public.auth_has_role('parent')
  );
create policy exam_terms_write on public.exam_terms
  for all using (public.auth_has_role('principal'))
  with check (public.auth_has_role('principal'));

create policy grade_scale_select on public.grade_scale
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or public.auth_has_role('teacher') or public.auth_has_role('parent')
  );
create policy grade_scale_write on public.grade_scale
  for all using (public.auth_has_role('principal'))
  with check (public.auth_has_role('principal'));

-- marks: principal/accountant read all. Teacher read+write scoped to their
-- own active teacher_subject_assignments (section+subject match) — M7 will
-- additionally gate writes on the student's result not yet being
-- approved/published once the results table exists.
create policy marks_select on public.marks
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or exists (
      select 1 from public.teacher_subject_assignments tsa
      where tsa.section_id = marks.section_id
        and tsa.subject_id = marks.subject_id
        and tsa.teacher_staff_id = public.current_staff_id()
        and tsa.effective_to is null
    )
  );

create policy marks_write_teacher on public.marks
  for all using (
    exists (
      select 1 from public.teacher_subject_assignments tsa
      where tsa.section_id = marks.section_id
        and tsa.subject_id = marks.subject_id
        and tsa.teacher_staff_id = public.current_staff_id()
        and tsa.effective_to is null
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
  );

create policy marks_write_principal on public.marks
  for all using (public.auth_has_role('principal'))
  with check (public.auth_has_role('principal'));

create policy marks_audit_select on public.marks_audit
  for select using (public.auth_has_role('principal'));
