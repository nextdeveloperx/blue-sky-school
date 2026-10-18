-- Logs every bulk export BEFORE the data streams to the client — closes the
-- "protect against unauthorized exports" requirement even for legitimate
-- users (accountability, not prevention). Two-step: request_export logs
-- intent and returns an id; complete_export records the actual row count
-- once the client has run its (already RLS-scoped) query.

create table public.export_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.staff (id),
  export_type text not null
    check (export_type in ('students', 'payments', 'results', 'payroll', 'expenses')),
  filters jsonb,
  row_count int,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.export_requests enable row level security;

create policy export_requests_select on public.export_requests
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));
-- No direct insert/update policy — request_export / complete_export only.

create function public.request_export(p_export_type text, p_filters jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_id uuid;
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may export data';
  end if;
  v_staff_id := public.current_staff_id();

  insert into public.export_requests (requested_by, export_type, filters)
  values (v_staff_id, p_export_type, p_filters)
  returning id into v_id;

  return v_id;
end;
$$;

create function public.complete_export(p_export_request_id uuid, p_row_count int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.auth_has_role('principal') or public.auth_has_role('accountant')) then
    raise exception 'only principal or accountant may complete an export';
  end if;

  update public.export_requests
  set row_count = p_row_count, completed_at = now()
  where id = p_export_request_id
    and requested_by = public.current_staff_id();
end;
$$;

revoke execute on function public.request_export(text, jsonb) from public, anon;
grant execute on function public.request_export(text, jsonb) to authenticated;
revoke execute on function public.complete_export(uuid, int) from public, anon;
grant execute on function public.complete_export(uuid, int) to authenticated;
