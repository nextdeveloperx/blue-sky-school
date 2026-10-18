alter table public.students enable row level security;
alter table public.student_section_history enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;

-- students ------------------------------------------------------------------
-- Principal/accountant: full read. Teacher: read-only, scoped to the
-- sections where they are the class teacher (interim M2 scope — M3 adds
-- subject-grained teacher_subject_assignments for finer write-side rules on
-- marks; this general roster visibility stays tied to class-teacher status).
-- Parent read access arrives in M8 once verified links exist.
create policy students_select on public.students
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or exists (
      select 1 from public.sections s
      where s.id = students.current_section_id
        and s.class_teacher_staff_id = public.current_staff_id()
    )
  );

create policy students_write_staff on public.students
  for all using (public.auth_has_role('principal') or public.auth_has_role('accountant'))
  with check (public.auth_has_role('principal') or public.auth_has_role('accountant'));

-- student_section_history ----------------------------------------------------
-- Read-only to everyone who can read the student; writes only via the
-- students trigger (security definer), never direct.
create policy student_section_history_select on public.student_section_history
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or exists (
      select 1 from public.students st
      join public.sections s on s.id = st.current_section_id
      where st.id = student_section_history.student_id
        and s.class_teacher_staff_id = public.current_staff_id()
    )
  );

-- guardians / student_guardians ----------------------------------------------
create policy guardians_select on public.guardians
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));
create policy guardians_write on public.guardians
  for all using (public.auth_has_role('principal') or public.auth_has_role('accountant'))
  with check (public.auth_has_role('principal') or public.auth_has_role('accountant'));

create policy student_guardians_select on public.student_guardians
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));
create policy student_guardians_write on public.student_guardians
  for all using (public.auth_has_role('principal') or public.auth_has_role('accountant'))
  with check (public.auth_has_role('principal') or public.auth_has_role('accountant'));
