-- Teacher subject assignments (class+section+subject+teacher+year grain) and
-- the derived roster view. Deliberately a VIEW, not a maintained table: a
-- maintained roster would need syncing on three independent events
-- (reassignment, student transfer, withdrawal) and any missed sync silently
-- desyncs an exam-entry UI from reality. A view reading current_section_id
-- live is always correct by construction and cheap at this scale.

create table public.teacher_subject_assignments (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id),
  section_id uuid not null references public.sections (id),
  subject_id uuid not null references public.subjects (id),
  teacher_staff_id uuid not null references public.staff (id),
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now()
);

-- At most one ACTIVE teacher per section+subject at a time. Reassignment
-- closes one row (effective_to) and opens a new one — never an in-place
-- update of the teacher — so marks entered under the old assignment stay
-- attributable to who actually entered them.
create unique index teacher_subject_assignments_one_active
  on public.teacher_subject_assignments (section_id, subject_id)
  where effective_to is null;

alter table public.teacher_subject_assignments enable row level security;

create policy tsa_select on public.teacher_subject_assignments
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or teacher_staff_id = public.current_staff_id()
  );

create policy tsa_write_principal on public.teacher_subject_assignments
  for all using (public.auth_has_role('principal'))
  with check (public.auth_has_role('principal'));

-- security_invoker so the view is subject to the querying user's own RLS
-- (on teacher_subject_assignments and students), not the view owner's.
create view public.teacher_roster
  with (security_invoker = true)
  as
  select
    tsa.teacher_staff_id,
    tsa.section_id,
    tsa.subject_id,
    s.id as student_id,
    s.full_name,
    s.admission_no
  from public.teacher_subject_assignments tsa
  join public.students s
    on s.current_section_id = tsa.section_id and s.status = 'active'
  where tsa.effective_to is null;

-- Widen student visibility: a teacher can also see students in any section
-- they hold an active subject assignment for (not just sections where they
-- are the homeroom class teacher, per the M2 policy). Postgres combines
-- multiple permissive SELECT policies on the same table with OR.
create policy students_select_via_subject_assignment on public.students
  for select using (
    exists (
      select 1 from public.teacher_subject_assignments tsa
      where tsa.section_id = students.current_section_id
        and tsa.teacher_staff_id = public.current_staff_id()
        and tsa.effective_to is null
    )
  );
