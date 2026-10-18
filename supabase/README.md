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
