-- Enable RLS (default-deny) on every M1 table and add explicit policies.
-- Writes to user_roles happen ONLY through the assign_role() security-definer
-- RPC below — there are deliberately no insert/update/delete policies on it,
-- so even a principal cannot self-escalate via a raw table write.

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.academic_years enable row level security;
alter table public.staff enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.subjects enable row level security;

-- profiles --------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.auth_has_role('principal'));

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or public.auth_has_role('principal'));

-- user_roles --------------------------------------------------------------
create policy user_roles_select_own on public.user_roles
  for select using (user_id = auth.uid() or public.auth_has_role('principal'));

-- academic_years / classes / sections / subjects ---------------------------
-- Any signed-in app user (any of the 4 roles) may read org reference data;
-- only the principal may write it.
create policy org_ref_select_any_role on public.academic_years
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or public.auth_has_role('teacher') or public.auth_has_role('parent')
  );
create policy org_ref_write_principal on public.academic_years
  for all using (public.auth_has_role('principal'))
  with check (public.auth_has_role('principal'));

create policy org_ref_select_any_role on public.classes
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or public.auth_has_role('teacher') or public.auth_has_role('parent')
  );
create policy org_ref_write_principal on public.classes
  for all using (public.auth_has_role('principal'))
  with check (public.auth_has_role('principal'));

create policy org_ref_select_any_role on public.sections
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or public.auth_has_role('teacher') or public.auth_has_role('parent')
  );
create policy org_ref_write_principal on public.sections
  for all using (public.auth_has_role('principal'))
  with check (public.auth_has_role('principal'));

create policy org_ref_select_any_role on public.subjects
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or public.auth_has_role('teacher') or public.auth_has_role('parent')
  );
create policy org_ref_write_principal on public.subjects
  for all using (public.auth_has_role('principal'))
  with check (public.auth_has_role('principal'));

-- staff ---------------------------------------------------------------------
create policy staff_select on public.staff
  for select using (
    public.auth_has_role('principal') or public.auth_has_role('accountant')
    or profile_id = auth.uid()
  );
create policy staff_write_principal on public.staff
  for all using (public.auth_has_role('principal'))
  with check (public.auth_has_role('principal'));

-- assign_role RPC -----------------------------------------------------------
-- The only way user_roles ever changes. Principal-only. Idempotent (does
-- nothing if the role is already assigned, rather than erroring).
create function public.assign_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may assign roles';
  end if;
  if new_role not in ('principal', 'accountant', 'teacher', 'parent') then
    raise exception 'invalid role: %', new_role;
  end if;
  insert into public.user_roles (user_id, role)
  values (target_user_id, new_role)
  on conflict (user_id, role) do nothing;
end;
$$;
