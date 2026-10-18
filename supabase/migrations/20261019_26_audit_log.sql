-- Unified audit log for financial + parent-verification events. Academic
-- integrity already has its own dedicated trail (marks_audit, results_audit
-- from M6/M7) — this covers the rest: payments, refunds, payroll, and
-- parent-link verification decisions, the same way a payment dispute or a
-- wrongly-verified parent link needs a forensic trail, not someone's memory.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_profile_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function public.audit_row_change() from public, anon, authenticated;

create trigger payments_audit after insert on public.payments
  for each row execute function public.audit_row_change();

create trigger refunds_audit after insert on public.refunds
  for each row execute function public.audit_row_change();

create trigger payroll_runs_audit after update on public.payroll_runs
  for each row execute function public.audit_row_change();

create trigger parent_student_links_audit after update on public.parent_student_links
  for each row execute function public.audit_row_change();

alter table public.audit_log enable row level security;

create policy audit_log_select on public.audit_log
  for select using (public.auth_has_role('principal'));
