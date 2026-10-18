-- Identity layer: profiles (1:1 with auth.users), user_roles (4-role model),
-- and the security-definer helpers every later RLS policy builds on.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('principal', 'accountant', 'teacher', 'parent')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- Auto-create a profile row whenever a new Supabase Auth user is created.
-- Role assignment is a separate, deliberate step (assign_role RPC) — never
-- automatic, so nobody is ever implicitly granted principal/accountant access.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role-check helper used by every RLS policy. security definer + stable so
-- it can be called cheaply inside policies without re-triggering RLS on
-- user_roles itself.
create function public.auth_has_role(required_role text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = required_role
  );
$$;

