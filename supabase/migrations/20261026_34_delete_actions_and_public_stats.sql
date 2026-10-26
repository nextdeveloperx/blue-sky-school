-- PREPARED FOR REVIEW — NOT APPLIED TO PRODUCTION.
--
-- Additive schema + RPCs for three features in the "complete feature
-- enhancement plan": Fees archive, Staff account deactivation (made real,
-- not just a UI hide), and public homepage statistics. Nothing here
-- changes an existing column's type, removes a column, or alters an
-- existing function's signature. No RLS policy is loosened.
--
-- ---------------------------------------------------------------------
-- 1. Fee structures: archive flag (fee_schedules.fee_structure_id has no
--    ON DELETE CASCADE, so deleting a fee_structure that already has
--    generated dues is already blocked by the foreign key — this column
--    is the "safe alternative" the plan asks for when that's the case).
-- ---------------------------------------------------------------------
alter table public.fee_structures add column is_active boolean not null default true;

-- Without this, archiving a fee structure (above) would be purely cosmetic:
-- generate_monthly_fee_schedules (migration 12) joins fee_structures with
-- no is_active filter at all, so it would keep creating new monthly dues
-- against an "archived" structure forever. Same signature as the existing
-- function, so CREATE OR REPLACE is safe and keeps its existing grants —
-- only the join condition changes (adds `and fs.is_active`); the INSERT
-- target, the ON CONFLICT clause, and the authorization check are
-- byte-for-byte identical to the original. This never touches any
-- already-generated fee_schedules row, any payment, or any allocation —
-- it only narrows which structures are eligible for NEW rows going
-- forward, so all existing dues, payments, and financial history are
-- completely unaffected.
create or replace function public.generate_monthly_fee_schedules(p_academic_year_id uuid, p_period_month date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int;
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may generate fee schedules';
  end if;

  insert into public.fee_schedules (student_id, fee_structure_id, period_month, amount_due_minor)
  select s.id, fs.id, date_trunc('month', p_period_month)::date, fs.amount_minor
  from public.students s
  join public.sections sec on sec.id = s.current_section_id
  join public.fee_structures fs
    on fs.class_id = sec.class_id and fs.academic_year_id = p_academic_year_id and fs.is_active
  where s.academic_year_id = p_academic_year_id and s.status = 'active'
  on conflict (student_id, fee_structure_id, period_month) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function public.generate_monthly_fee_schedules(uuid, date) from public, anon;
grant execute on function public.generate_monthly_fee_schedules(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Staff account deactivation — made real.
--
-- profiles.is_active has existed since migration 01, and auth_has_role() /
-- is_verified_parent_of() were already tightened in migration 29 to check
-- it — so setting it false already blocks every RLS-gated table and every
-- role-gated RPC in the whole schema, immediately. What was missing is a
-- safe way to actually SET it for someone else: profiles RLS only ever
-- granted `profiles_update_own` (migration 03) — a principal could not
-- update another user's is_active at all. StaffPage.tsx's existing
-- toggleActive() silently no-ops today for that reason (RLS filters the
-- row out of the UPDATE, Supabase reports success with zero rows changed).
--
-- Deliberately an RPC, not a widened RLS policy — matching this project's
-- established pattern that role/access-affecting writes go through
-- security-definer functions (CLAUDE.md), not raw table grants.
create function public.deactivate_staff_account(p_profile_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_principal boolean;
  v_active_principal_count int;
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may deactivate a staff account';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'you cannot deactivate your own account';
  end if;

  -- Last-principal lockout guard: never allow the active principal count to
  -- hit zero through this path. (assign_role/revoke_role already block a
  -- principal from revoking their own role for the same reason — this is
  -- the equivalent protection for deactivation.)
  select exists (
    select 1 from public.user_roles where user_id = p_profile_id and role = 'principal'
  ) into v_is_principal;

  if v_is_principal then
    select count(*) into v_active_principal_count
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role = 'principal' and p.is_active and ur.user_id <> p_profile_id;

    if v_active_principal_count = 0 then
      raise exception 'cannot deactivate the last active principal account';
    end if;
  end if;

  -- p_reason is accepted for the caller's own confirmation-dialog UX (and
  -- for a future dedicated reason column, if ever needed) but is not
  -- persisted separately here: the profiles_audit trigger below already
  -- captures the full before/after row — including is_active, actor, and
  -- timestamp — for every update, which is more complete than a bare
  -- reason string on its own.
  update public.profiles set is_active = false where id = p_profile_id;
end;
$$;

create function public.reactivate_staff_account(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may reactivate a staff account';
  end if;
  update public.profiles set is_active = true where id = p_profile_id;
end;
$$;

revoke execute on function public.deactivate_staff_account(uuid, text) from public, anon;
grant execute on function public.deactivate_staff_account(uuid, text) to authenticated;
revoke execute on function public.reactivate_staff_account(uuid) from public, anon;
grant execute on function public.reactivate_staff_account(uuid) to authenticated;

-- Audit coverage for every is_active flip, same generic trigger already
-- used across the schema (migration 26) — profiles had no audit trigger
-- at all until now.
create trigger profiles_audit after update on public.profiles
  for each row execute function public.audit_row_change();

-- CRITICAL: close a bypass of the two RPCs above. profiles_update_own
-- (migration 03) is `using (id = auth.uid() or auth_has_role('principal'))`
-- with no WITH CHECK, so Postgres reuses USING as the check — meaning a
-- principal already has direct UPDATE access to every profile row,
-- including is_active, via a raw client call. That completely bypasses
-- both this migration's self-deactivation guard and its last-active-
-- principal lockout guard: a direct `.update({is_active:false})` against
-- ANY profile(s), run as many times as needed, is still RLS-permitted,
-- since row-level security has no awareness of the RPC's multi-row
-- lockout check. Column-level privilege is a separate, independent gate
-- Postgres checks in addition to RLS — revoking UPDATE specifically on
-- is_active from `authenticated` blocks every direct write path while
-- leaving the two SECURITY DEFINER RPCs unaffected (they run as the
-- function owner, not the calling role, so grantee-level column grants
-- don't apply to them). Every OTHER column profiles_update_own already
-- allowed (full_name, phone, email, etc.) is completely unchanged here.
revoke update (is_active) on public.profiles from authenticated;

-- ---------------------------------------------------------------------
-- 3. Public homepage statistics — a single, minimal, anon-grantable
--    SECURITY DEFINER function. Returns only three integers; never a row,
--    never a name, never anything from `students`/`staff` directly. This
--    follows the one existing precedent for a public-facing function
--    (submit_admission_enquiry, migration 30) rather than granting anon
--    any table access — `students`/`staff`/`school_settings` keep zero
--    anon grants.
--
--    school_settings is a single-row configuration table for facts that
--    have no other natural home (currently just the verified school
--    establishment date). It ships with ZERO rows — no fabricated date is
--    inserted here. Until a row with established_on is added by the
--    principal, get_public_school_stats() returns years_since_established
--    = null, and the homepage is expected to omit that statistic rather
--    than invent one.
-- ---------------------------------------------------------------------
create table public.school_settings (
  id boolean primary key default true,
  established_on date,
  updated_at timestamptz not null default now(),
  constraint school_settings_singleton check (id)
);

alter table public.school_settings enable row level security;
revoke all on public.school_settings from anon;

create policy school_settings_select on public.school_settings
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));
create policy school_settings_write on public.school_settings
  for all using (public.auth_has_role('principal')) with check (public.auth_has_role('principal'));

create function public.get_public_school_stats()
returns table (
  active_student_count int,
  active_teacher_count int,
  years_since_established numeric
)
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*)::int from public.students where status = 'active'),
    (select count(distinct st.id)::int
       from public.staff st
       join public.user_roles ur on ur.user_id = st.profile_id and ur.role = 'teacher'
       join public.profiles p on p.id = st.profile_id
       where st.is_active and p.is_active),
    (select case when established_on is null then null
            else extract(year from age(current_date, established_on))
            end
       from public.school_settings limit 1);
$$;

revoke execute on function public.get_public_school_stats() from public;
grant execute on function public.get_public_school_stats() to anon, authenticated;
