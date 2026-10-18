-- Parent portal: parents (own login identity, distinct from the school's
-- on-file guardians record), and parent_student_links — the single source
-- of truth gating every parent-facing read, never inferred client-side.

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table public.parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents (id) on delete cascade,
  student_id uuid not null references public.students (id),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verification_method text not null default 'manual_approval'
    check (verification_method in ('manual_approval', 'admission_code')),
  verified_by uuid references public.staff (id),
  verified_at timestamptz,
  requested_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

-- Extend the M1 signup trigger: a /portal signup (flagged via signup_source
-- in auth metadata) auto-creates a parents row and grants the 'parent' role
-- immediately — safe to automate because the parent role alone grants zero
-- data access until a link is separately verified by staff. Admin-side
-- signup (principal/accountant/teacher) is deliberately NOT auto-granted
-- here; that still requires an explicit assign_role call.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);

  if new.raw_user_meta_data ->> 'signup_source' = 'portal' then
    insert into public.parents (profile_id, email)
    values (new.id, new.email);

    insert into public.user_roles (user_id, role)
    values (new.id, 'parent')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

-- Security-definer helper centralizing the verified-link check — every
-- parent-facing policy calls this instead of re-deriving it, so changing
-- the verification model later is a one-function edit.
create function public.is_verified_parent_of(p_student_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.parent_student_links l
    join public.parents p on p.id = l.parent_id
    where p.profile_id = auth.uid()
      and l.student_id = p_student_id
      and l.verification_status = 'verified'
  );
$$;

-- Submits a pending link request. Returns a generic success regardless of
-- whether admission_no matched a real student, so an unauthenticated-
-- feeling prober can't enumerate valid admission numbers by trying values
-- and observing different responses.
create function public.request_student_link(p_admission_no text, p_child_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_id uuid;
  v_student_id uuid;
begin
  if not public.auth_has_role('parent') then
    raise exception 'only a parent account may request a student link';
  end if;

  select id into v_parent_id from public.parents where profile_id = auth.uid();
  select id into v_student_id from public.students where admission_no = p_admission_no;

  if v_student_id is not null then
    insert into public.parent_student_links (parent_id, student_id)
    values (v_parent_id, v_student_id)
    on conflict (parent_id, student_id) do nothing;
  end if;
  -- else: silently no-op — same return value either way.
end;
$$;

-- Principal/accountant review a pending request.
create function public.review_link_request(p_link_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may review a parent link request';
  end if;
  if p_decision not in ('verified', 'rejected') then
    raise exception 'decision must be verified or rejected';
  end if;
  v_staff_id := public.current_staff_id();

  update public.parent_student_links
  set verification_status = p_decision, verified_by = v_staff_id, verified_at = now()
  where id = p_link_id and verification_status = 'pending';
end;
$$;
