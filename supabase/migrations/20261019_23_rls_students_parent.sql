-- A parent needs to see their linked child's basic info (name, admission
-- number) to render the dashboard — including for a still-pending link, so
-- they can confirm what they requested. Deeper data (results, fees) stays
-- gated to verified-only via the policies added in migration 22.
create policy students_select_parent on public.students
  for select using (
    exists (
      select 1 from public.parent_student_links l
      join public.parents p on p.id = l.parent_id
      where p.profile_id = auth.uid() and l.student_id = students.id
    )
  );
