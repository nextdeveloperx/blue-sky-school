-- Core organizational structure: academic years (Apr-Mar), classes, sections,
-- subjects, and staff HR records.

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only one academic year may be marked current at a time.
create unique index academic_years_single_current
  on public.academic_years (is_current)
  where is_current;

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  staff_code text unique,
  designation text,
  date_joined date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name text not null,
  sort_order int,
  created_at timestamptz not null default now(),
  unique (academic_year_id, name)
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null,
  class_teacher_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  unique (class_id, name)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  unique (academic_year_id, name)
);

-- Resolves the calling user's staff.id (null if they are not staff, e.g. a parent).
create function public.current_staff_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.staff where profile_id = auth.uid();
$$;
