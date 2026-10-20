-- Admissions enquiry tracking.
--
-- This is the FIRST table in the schema that must accept a write from a
-- truly anonymous, logged-out visitor (every other public-facing write —
-- parent signup, parent-link requests — comes from an authenticated
-- session). That changes the trust model: there is no auth.uid() to check
-- against, so every protection has to live inside one tightly-scoped
-- security-definer RPC rather than relying on auth_has_role()-style policies.
--
-- Design, matching this project's established "RPC is the sole writer"
-- pattern (user_roles, staff_invitations, payments, ...): the table has NO
-- insert/update/delete RLS policy for anyone at all, not even the
-- principal. submit_admission_enquiry() is the only way a row is ever
-- created; update_enquiry() is the only way one is ever changed. A SELECT
-- policy grants read access to principal (all rows) and to accountant
-- (their own assigned rows only) — anon has no SELECT grant whatsoever, so
-- there is no view or policy path by which a public visitor could read
-- back their own or anyone else's enquiry, let alone the internal notes.

create table public.admission_enquiries (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null check (char_length(parent_name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  email text check (email is null or email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  student_name text check (student_name is null or char_length(student_name) <= 120),
  applying_for_class text not null check (char_length(applying_for_class) between 1 and 60),
  academic_session text not null check (char_length(academic_session) between 1 and 20),
  message text check (message is null or char_length(message) <= 1000),
  consent boolean not null,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'follow_up_required', 'admitted', 'closed')),
  assigned_staff_id uuid references public.staff (id),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000),
  follow_up_date date,
  -- Best-effort client IP for abuse tracking only. Never exposed to anon —
  -- there is no SELECT grant for anon on this table at all — and reading
  -- it gracefully degrades to null if the request.headers GUC isn't
  -- present (see submit_admission_enquiry below).
  submitted_ip text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Plain btree indexes are enough at this school's expected scale (hundreds
-- of enquiries, not millions) — deliberately not adding the pg_trgm
-- extension for fuzzy name search, to avoid an extension dependency this
-- project doesn't otherwise need. Name search uses a sequential ILIKE scan,
-- which is fine at this volume.
create index admission_enquiries_status_idx on public.admission_enquiries (status);
create index admission_enquiries_assigned_staff_idx on public.admission_enquiries (assigned_staff_id);
create index admission_enquiries_created_at_idx on public.admission_enquiries (created_at desc);
create index admission_enquiries_phone_idx on public.admission_enquiries (phone);
create index admission_enquiries_email_idx on public.admission_enquiries (email);

alter table public.admission_enquiries enable row level security;

-- Supabase grants SELECT on every new public table to anon/authenticated
-- by default — revoke it from anon explicitly rather than relying only on
-- the RLS policy below. Without this, an anon SELECT attempt still reveals
-- no data (it fails evaluating the policy's auth_has_role()/
-- current_staff_id() calls, which are themselves anon-restricted), but
-- that's an incidental side effect of other migrations, not a boundary
-- declared here. Belt-and-suspenders: make the denial explicit and
-- self-contained in this migration.
revoke all on public.admission_enquiries from anon;

-- Principal reads everything; an accountant (the realistic front-office /
-- admissions-coordination role in this schema) reads only enquiries
-- explicitly assigned to them. Teachers and parents get nothing — no
-- policy clause covers them. No insert/update/delete policy exists for
-- ANY role — see the RPCs below.
create policy admission_enquiries_select on public.admission_enquiries
  for select using (
    public.auth_has_role('principal')
    or (public.auth_has_role('accountant') and assigned_staff_id = public.current_staff_id())
  );

-- The sole public submission path. Deliberately the only function in this
-- entire schema granted to `anon` — every other RPC is authenticated-only.
-- Every protection (format validation, consent, honeypot, rate limiting,
-- idempotency) lives here because there is no RLS policy and no auth.uid()
-- to lean on for an anonymous caller.
create function public.submit_admission_enquiry(
  p_parent_name text,
  p_phone text,
  p_email text,
  p_student_name text,
  p_applying_for_class text,
  p_academic_session text,
  p_message text,
  p_consent boolean,
  p_idempotency_key text,
  p_honeypot text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ip text;
  v_recent_count int;
begin
  -- Honeypot: a hidden field no human ever fills in. A bot that fills
  -- every field gets a convincing "success" with nothing ever written, so
  -- it has no signal that it was detected (silently discarding — not
  -- raising an exception — is the point).
  if p_honeypot is not null and p_honeypot <> '' then
    return gen_random_uuid();
  end if;

  if p_idempotency_key is null or p_idempotency_key = '' then
    raise exception 'missing idempotency key';
  end if;

  -- Idempotent replay FIRST: a retried call with the same client-generated
  -- key returns the existing enquiry's id rather than re-validating,
  -- re-rate-limiting, or creating a duplicate — mirrors the
  -- payments/salary_adjustments idempotency-key pattern elsewhere.
  select id into v_id from public.admission_enquiries where idempotency_key = p_idempotency_key;
  if found then
    return v_id;
  end if;

  if not coalesce(p_consent, false) then
    raise exception 'consent to be contacted is required';
  end if;
  if p_parent_name is null or char_length(trim(p_parent_name)) < 2 then
    raise exception 'enter the parent/guardian name';
  end if;
  if char_length(trim(p_parent_name)) > 120 then
    raise exception 'name is too long';
  end if;
  -- E.164-ish: optional leading +, 7-15 digits — accepts international
  -- numbers, not just a 10-digit Indian pattern. Normalization (stripping
  -- spaces/hyphens/parens) happens client-side before this is called.
  if p_phone is null or p_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'enter a valid contact number';
  end if;
  if p_email is not null and p_email <> '' and p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'enter a valid email address';
  end if;
  if p_student_name is not null and char_length(p_student_name) > 120 then
    raise exception 'student name is too long';
  end if;
  if p_applying_for_class is null or char_length(trim(p_applying_for_class)) = 0 then
    raise exception 'select the class you are applying for';
  end if;
  if p_academic_session is null or char_length(trim(p_academic_session)) = 0 then
    raise exception 'academic session is required';
  end if;
  if p_message is not null and char_length(p_message) > 1000 then
    raise exception 'message is too long';
  end if;

  -- Best-effort client IP, read from the GUC PostgREST sets per request.
  -- Wrapped defensively: some contexts (direct psql, local test harnesses)
  -- won't have this set at all, and that must never break a legitimate
  -- submission — it just means the IP-based rate limit below is skipped.
  begin
    v_ip := nullif(split_part(coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-forwarded-for', ',', 1), '');
  exception when others then
    v_ip := null;
  end;

  -- Real server-side rate limiting (not a frontend cooldown): this runs on
  -- every call, inside the same security-definer function a client cannot
  -- bypass. Capped by phone/email first (always available), and
  -- additionally by IP when the header was present.
  select count(*) into v_recent_count
  from public.admission_enquiries
  where created_at > now() - interval '15 minutes'
    and (phone = p_phone or (p_email is not null and p_email <> '' and email = p_email));
  if v_recent_count >= 3 then
    raise exception 'too many enquiries submitted recently — please wait a few minutes and try again';
  end if;

  if v_ip is not null then
    select count(*) into v_recent_count
    from public.admission_enquiries
    where created_at > now() - interval '1 hour' and submitted_ip = v_ip;
    if v_recent_count >= 10 then
      raise exception 'too many enquiries submitted recently from this network — please try again later';
    end if;
  end if;

  -- status/assigned_staff_id/internal_notes/follow_up_date are never
  -- parameters here — there is no way for this function's caller to set
  -- them, regardless of what a crafted request supplies, since they are
  -- simply absent from the function's signature.
  insert into public.admission_enquiries (
    parent_name, phone, email, student_name, applying_for_class,
    academic_session, message, consent, idempotency_key, submitted_ip
  ) values (
    trim(p_parent_name),
    p_phone,
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_student_name, '')), ''),
    trim(p_applying_for_class),
    trim(p_academic_session),
    nullif(trim(coalesce(p_message, '')), ''),
    true,
    p_idempotency_key,
    v_ip
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Staff-side updates: status, assignment, internal notes, follow-up date.
-- Principal may update any enquiry including reassigning it; an accountant
-- may update ONLY an enquiry already assigned to them, and may never
-- reassign (reassignment — deciding who owns an enquiry — stays a
-- principal-level allocation decision).
create function public.update_enquiry(
  p_enquiry_id uuid,
  p_status text default null,
  p_assigned_staff_id uuid default null,
  p_clear_assignment boolean default false,
  p_internal_notes text default null,
  p_follow_up_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_staff_id uuid;
  v_current_assigned uuid;
  v_is_principal boolean;
begin
  v_is_principal := public.auth_has_role('principal');
  if not (v_is_principal or public.auth_has_role('accountant')) then
    raise exception 'only the principal or an authorized staff member may update enquiries';
  end if;

  select assigned_staff_id into v_current_assigned
  from public.admission_enquiries where id = p_enquiry_id;
  if not found then
    raise exception 'enquiry not found';
  end if;

  v_caller_staff_id := public.current_staff_id();
  if not v_is_principal and v_current_assigned is distinct from v_caller_staff_id then
    raise exception 'you may only update enquiries assigned to you';
  end if;
  if not v_is_principal and (p_assigned_staff_id is not null or p_clear_assignment) then
    raise exception 'only the principal may reassign an enquiry';
  end if;

  if p_status is not null and p_status not in ('new', 'contacted', 'follow_up_required', 'admitted', 'closed') then
    raise exception 'invalid status: %', p_status;
  end if;
  if p_assigned_staff_id is not null and not exists (select 1 from public.staff where id = p_assigned_staff_id) then
    raise exception 'invalid staff id';
  end if;
  if p_internal_notes is not null and char_length(p_internal_notes) > 4000 then
    raise exception 'notes are too long';
  end if;

  update public.admission_enquiries
  set
    status = coalesce(p_status, status),
    assigned_staff_id = case
      when p_clear_assignment then null
      when p_assigned_staff_id is not null then p_assigned_staff_id
      else assigned_staff_id
    end,
    internal_notes = coalesce(p_internal_notes, internal_notes),
    follow_up_date = coalesce(p_follow_up_date, follow_up_date),
    updated_at = now()
  where id = p_enquiry_id;
end;
$$;

-- Grants. submit_admission_enquiry is the one deliberate exception to
-- "anon can call nothing" in this schema — scoped as tightly as the rest
-- of this migration can make it (no anon SELECT at all, full server-side
-- validation, rate limiting, and a fixed insert-only column set).
revoke execute on function public.submit_admission_enquiry(text, text, text, text, text, text, text, boolean, text, text) from public;
grant execute on function public.submit_admission_enquiry(text, text, text, text, text, text, text, boolean, text, text) to anon, authenticated;

revoke execute on function public.update_enquiry(uuid, text, uuid, boolean, text, date) from public, anon;
grant execute on function public.update_enquiry(uuid, text, uuid, boolean, text, date) to authenticated;

-- Audit trail: the same generic trigger already used for payments/refunds/
-- payroll_runs/parent_student_links (migration 26). On INSERT the actor is
-- null (a genuinely anonymous visitor has no auth.uid() — this is
-- correct, not a bug: it records that the row was created by an anonymous
-- public submission, and that value comes from the real JWT context, not
-- anything the client supplies, so it can't be forged into impersonating
-- staff). On UPDATE the actor is the real authenticated staff member who
-- called update_enquiry.
create trigger admission_enquiries_audit
  after insert or update on public.admission_enquiries
  for each row execute function public.audit_row_change();
