-- Principal-controlled staff provisioning + the missing "inverse" RPCs.
--
-- Problem this closes: the only way a teacher/accountant ever got an account
-- was the public admin-login signup toggle (now removed from the UI) —
-- there was no principal-initiated provisioning path at all, and no way to
-- revoke a role or a verified parent-child link once granted. This migration
-- adds both without touching any existing table's shape or any existing
-- function's signature.
--
-- Trust model: a new signup NEVER grants teacher/accountant/principal
-- access by itself (unchanged from migration 01/21). The only new thing a
-- signup can do is get auto-provisioned into a role the PRINCIPAL already
-- authorized earlier, server-side, via invite_staff — never from anything
-- the signing-up client supplies. This mirrors the existing portal-signup
-- pattern (migration 21) exactly, just keyed off a principal-created
-- invitation row instead of a client-supplied signup_source tag.

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('teacher', 'accountant')),
  designation text,
  invited_by uuid not null references public.staff (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- At most one PENDING invitation per email — re-inviting revokes the old
-- one first (see invite_staff), so there's never ambiguity about which
-- invitation a signup should consume.
create unique index staff_invitations_one_pending_per_email
  on public.staff_invitations (lower(email))
  where status = 'pending';

alter table public.staff_invitations enable row level security;

-- No insert/update/delete policy for anyone, including the principal —
-- exactly like user_roles. The RPCs below are the only write path, so every
-- invitation and every acceptance is independently auditable and the
-- principal can't be bypassed by a direct table write even by themselves.
create policy staff_invitations_select_principal on public.staff_invitations
  for select using (public.auth_has_role('principal'));

-- Principal-only: create (or replace) a pending invitation for an email.
-- Deliberately restricted to teacher/accountant — granting 'principal' stays
-- a direct, deliberate assign_role call by an existing principal, never a
-- lightweight invite, so a second principal is never created casually.
create function public.invite_staff(p_email text, p_role text, p_designation text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter_staff_id uuid;
  v_invitation_id uuid;
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may invite staff';
  end if;
  if p_role not in ('teacher', 'accountant') then
    raise exception 'invitations may only grant teacher or accountant';
  end if;
  if p_email is null or p_email = '' then
    raise exception 'email is required';
  end if;

  v_inviter_staff_id := public.current_staff_id();
  if v_inviter_staff_id is null then
    raise exception 'the principal must have their own staff record before inviting others';
  end if;

  -- Superseding re-invite: revoke any still-pending invite for this email
  -- first so the new one is the only pending row (the partial unique index
  -- would otherwise reject the insert).
  update public.staff_invitations
  set status = 'revoked'
  where lower(email) = lower(p_email) and status = 'pending';

  insert into public.staff_invitations (email, role, designation, invited_by)
  values (lower(p_email), p_role, p_designation, v_inviter_staff_id)
  returning id into v_invitation_id;

  return v_invitation_id;
end;
$$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may revoke an invitation';
  end if;
  update public.staff_invitations
  set status = 'revoked'
  where id = p_invitation_id and status = 'pending';
end;
$$;

-- profiles.is_active and staff.is_active have existed since migration 01/02
-- but were never actually checked anywhere — an "inactive" account was
-- indistinguishable from an active one at the data layer. auth_has_role()
-- is the single helper every RLS policy in the whole schema calls, so
-- tightening it here retroactively enforces "an inactive account gets zero
-- protected access" everywhere at once, without touching any of the dozens
-- of policies that call it. Same signature, so CREATE OR REPLACE keeps its
-- existing grants (authenticated only, no anon — migration 05).
create or replace function public.auth_has_role(required_role text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role = required_role and p.is_active
  );
$$;

-- Same reasoning as auth_has_role above, applied to the parent-side
-- equivalent helper (migration 21) — a deactivated parent profile loses
-- access to every parent-gated table in one edit here, same signature, same
-- preserved grants.
create or replace function public.is_verified_parent_of(p_student_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_student_links l
    join public.parents p on p.id = l.parent_id
    join public.profiles pr on pr.id = p.profile_id
    where p.profile_id = auth.uid()
      and l.student_id = p_student_id
      and l.verification_status = 'verified'
      and pr.is_active
  );
$$;

-- The missing inverse of assign_role (migration 03 only ever grants). A
-- principal cannot revoke their OWN principal role — the one lockout this
-- system has no recovery path for, so it's blocked outright rather than
-- risking a school with zero principal accounts.
create function public.revoke_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may revoke a role';
  end if;
  if p_user_id = auth.uid() and p_role = 'principal' then
    raise exception 'the principal cannot revoke their own principal role';
  end if;
  delete from public.user_roles where user_id = p_user_id and role = p_role;
end;
$$;

-- The missing inverse of review_link_request — review_link_request only
-- ever updates a row while it is still 'pending', so a VERIFIED link had no
-- way to be corrected or revoked later (e.g. the relationship changes, or
-- verification is later found to be wrong). Reuses the existing
-- verification_status enum ('rejected') rather than widening the CHECK
-- constraint; the audit_log trigger already on this table (migration 26)
-- captures the full before/after row on every update, including this one.
create function public.revoke_parent_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may revoke a parent-child link';
  end if;
  update public.parent_student_links
  set verification_status = 'rejected', verified_by = public.current_staff_id(), verified_at = now()
  where id = p_link_id and verification_status = 'verified';
end;
$$;

-- handle_new_user: same signature as migration 21's version (CREATE OR
-- REPLACE here is valid and preserves its existing revoke-from-all grants —
-- it must stay trigger-only, never directly RPC-callable). Adds exactly one
-- new branch: consume a matching pending staff invitation, if any. Nothing
-- about the existing profile-creation or portal-signup branch changes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
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

  -- Server-trusted staff provisioning: the role and designation come from a
  -- row the PRINCIPAL wrote earlier via invite_staff, never from anything
  -- in this signup request itself (new.raw_user_meta_data is never read
  -- for this branch).
  select * into v_invitation
  from public.staff_invitations
  where lower(email) = lower(new.email) and status = 'pending'
  limit 1;

  if found then
    insert into public.staff (profile_id, designation)
    values (new.id, v_invitation.designation);

    insert into public.user_roles (user_id, role)
    values (new.id, v_invitation.role)
    on conflict (user_id, role) do nothing;

    update public.staff_invitations
    set status = 'accepted', accepted_at = now()
    where id = v_invitation.id;
  end if;

  return new;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on function creation —
-- revoke from public and anon explicitly, grant only to authenticated (each
-- function self-checks the caller's role internally), matching the
-- established pattern (migrations 04/05/14).
revoke execute on function public.invite_staff(text, text, text) from public, anon;
grant execute on function public.invite_staff(text, text, text) to authenticated;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;
revoke execute on function public.revoke_role(uuid, text) from public, anon;
grant execute on function public.revoke_role(uuid, text) to authenticated;
revoke execute on function public.revoke_parent_link(uuid) from public, anon;
grant execute on function public.revoke_parent_link(uuid) to authenticated;

-- Audit trail coverage for role/staff lifecycle changes, using the same
-- generic trigger already attached to payments/refunds/payroll_runs/
-- parent_student_links (migration 26) — no new audit machinery needed.
create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function public.audit_row_change();

create trigger staff_invitations_audit after insert or update on public.staff_invitations
  for each row execute function public.audit_row_change();

create trigger staff_audit after insert or update on public.staff
  for each row execute function public.audit_row_change();
