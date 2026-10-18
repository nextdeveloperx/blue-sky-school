-- Exam terms, configurable grade scale, and marks entry. marks_audit is
-- append-only history populated by trigger — a teacher may edit a mark
-- after submission but before approval (M7 locks that), and every change
-- is captured here, never silently lost.

create table public.exam_terms (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id),
  name text not null,
  sort_order int,
  status text not null default 'open' check (status in ('open', 'locked')),
  created_at timestamptz not null default now(),
  unique (academic_year_id, name)
);

-- Configurable percentage->grade bands, year-scoped so they can be revised
-- yearly. Content (the actual cutoffs) is a principal decision, not a code
-- change — ships with no default rows, the principal adds them.
create table public.grade_scale (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id),
  min_percent numeric not null check (min_percent >= 0 and min_percent <= 100),
  max_percent numeric not null check (max_percent >= 0 and max_percent <= 100),
  grade_label text not null,
  remark text,
  created_at timestamptz not null default now(),
  check (min_percent <= max_percent)
);

create table public.marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  section_id uuid not null references public.sections (id),
  subject_id uuid not null references public.subjects (id),
  exam_term_id uuid not null references public.exam_terms (id),
  raw_score numeric not null check (raw_score >= 0),
  max_score numeric not null check (max_score > 0),
  entered_by uuid not null references public.staff (id),
  entered_at timestamptz not null default now(),
  updated_by uuid references public.staff (id),
  updated_at timestamptz,
  check (raw_score <= max_score),
  unique (student_id, subject_id, exam_term_id)
);

create table public.marks_audit (
  id uuid primary key default gen_random_uuid(),
  mark_id uuid not null references public.marks (id) on delete cascade,
  student_id uuid not null,
  subject_id uuid not null,
  exam_term_id uuid not null,
  raw_score numeric not null,
  max_score numeric not null,
  changed_by uuid not null references public.staff (id),
  changed_at timestamptz not null default now(),
  change_type text not null check (change_type in ('insert', 'update'))
);

create function public.track_marks_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.marks_audit
    (mark_id, student_id, subject_id, exam_term_id, raw_score, max_score, changed_by, change_type)
  values (
    new.id, new.student_id, new.subject_id, new.exam_term_id, new.raw_score, new.max_score,
    coalesce(new.updated_by, new.entered_by),
    case when tg_op = 'INSERT' then 'insert' else 'update' end
  );
  return new;
end;
$$;

create trigger marks_track_change
  after insert or update on public.marks
  for each row execute function public.track_marks_change();

revoke execute on function public.track_marks_change() from public, anon, authenticated;
