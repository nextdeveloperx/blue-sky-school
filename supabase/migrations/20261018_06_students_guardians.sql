-- Students, guardians, and the student<->section history needed so a
-- mid-year section transfer never rewrites or loses historical context.

create table public.students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  full_name text not null,
  dob date,
  gender text,
  admission_date date,
  academic_year_id uuid not null references public.academic_years (id),
  current_section_id uuid not null references public.sections (id),
  status text not null default 'active' check (status in ('active', 'inactive', 'alumni')),
  created_at timestamptz not null default now()
);

create table public.student_section_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  section_id uuid not null references public.sections (id),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now()
);

-- At most one open (effective_to is null) history row per student at a time.
create unique index student_section_history_one_open
  on public.student_section_history (student_id)
  where effective_to is null;

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  relation text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (student_id, guardian_id)
);

-- Keeps student_section_history in sync automatically: on admission, opens
-- the first history row; on a section change, closes the old row and opens
-- a new one. Historical marks (added in M6) key off the section recorded at
-- entry time and are never touched by this.
create function public.track_student_section_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.student_section_history (student_id, section_id, effective_from)
    values (new.id, new.current_section_id, coalesce(new.admission_date, current_date));
    return new;
  end if;

  if tg_op = 'UPDATE' and new.current_section_id is distinct from old.current_section_id then
    update public.student_section_history
    set effective_to = current_date
    where student_id = new.id and effective_to is null;

    insert into public.student_section_history (student_id, section_id, effective_from)
    values (new.id, new.current_section_id, current_date);
  end if;

  return new;
end;
$$;

create trigger students_track_section_change
  after insert or update on public.students
  for each row execute function public.track_student_section_change();
