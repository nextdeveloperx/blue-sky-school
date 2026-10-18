# Supabase backend

Project: `blue-sky-school-sms` (ref `rsnhwxddfqqoifygeplq`, region `ap-south-1`).

## Migrations

Files in `migrations/` are applied in filename order and mirror exactly what
has been run against the live project — they are a record, not a to-do list.
When adding a new migration:

1. Write the `.sql` file here first (one logical change per file).
2. Apply it to the project (via the Supabase dashboard SQL editor, the
   Supabase CLI, or the MCP `apply_migration` tool).
3. After any RLS-touching migration, re-run the security advisor
   (`get_advisors` / Supabase dashboard → Advisors) and address new findings
   before moving on.

## Roles

Four roles in `user_roles`: `principal`, `accountant`, `teacher`, `parent`.
Role assignment only ever happens through the `assign_role(target_user_id,
new_role)` RPC, which is principal-only (self-checked inside the function).
There is no direct insert/update policy on `user_roles` — this is deliberate,
so nobody can self-escalate via a raw table write even if they are the
principal.

**Bootstrapping the first principal**: since `assign_role` requires an
existing principal to call it, the very first principal must be granted
manually (one-time) via the SQL editor after that person signs up through
the app:

```sql
insert into user_roles (user_id, role)
values ('<their auth.users id>', 'principal');
```

## Audit trail

Three layers, deliberately not merged into one table (different lifecycles,
different RLS needs):

- `audit_log` — payments, refunds, payroll_runs status changes, and
  parent_student_links verification decisions. Trigger-populated
  (`audit_row_change`), principal-only read.
- `marks_audit` — every insert/update to `marks`, so a teacher's post-
  submission edit is never silently lost.
- `results_audit` — every status transition on `results` (approve/reject/
  publish/reopen), with the reason attached for reject/reopen.

All three are populated exclusively by triggers or security-definer RPCs —
never by application code remembering to log, which is the failure mode this
is meant to close.

## Backup & recovery

**Primary**: Supabase's built-in daily automated backups (project-level,
configured in the Supabase dashboard → Database → Backups). Point-in-Time
Recovery (PITR) is a paid-tier feature — worth enabling once this holds real
student/financial data, since daily backups alone mean up to 24h of
potential loss.

**Supplemental (recommended, not yet automated)**: a scheduled off-platform
export of at least `payments`, `payroll_runs`/`payslips`, `expenses`,
`audit_log`, `marks`, `results` to storage independent of Supabase itself
(e.g., a Supabase Edge Function on a cron trigger running `pg_dump` or
`supabase db dump`, pushed to a private bucket). Not implemented yet — this
is the one piece of the original architecture plan that needs actual
infrastructure setup (an Edge Function + a storage destination) beyond what
this session's tooling could provision; flagged here so it isn't silently
dropped.

**Recovery drill (do this before relying on backups for anything real)**:
restore the latest backup into a scratch Supabase project (or a branch) and
verify:
1. Row counts roughly match production for the core tables.
2. A sampled payment's allocation chain reconstructs correctly
   (`sum(payment_allocations.allocated_amount_minor)` for that payment
   equals `payments.amount_minor`).
3. A sampled result's `results_audit` trail reconstructs its full
   draft → approved → published history.

An untested backup is not a backup — repeat this quarterly once there's real
data to restore.
