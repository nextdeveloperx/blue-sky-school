# CLAUDE.md

Guidance for Claude Code (or any agent) working in this repository.

## What this project is

Blue Sky School's public marketing site plus a School Management System
(SMS): admin dashboards for principal/accountant/teacher at `/admin/*`, a
parent-facing "Family Dashboard" at `/portal/*`, and a unified `/login`.
Backend is Supabase (Postgres + Auth + Row Level Security). See `README.md`
for the user-facing structure.

## Hard rules — read before touching the database

- **This project's Supabase project is a live production instance with a
  real principal account**, not a disposable dev sandbox. Treat every
  migration and every direct SQL call accordingly.
- **Never apply a migration to production without the user's explicit
  go-ahead.** Write new migrations as new files in `supabase/migrations/`
  with a comment block explaining what they do and how to roll them back,
  and leave them unapplied until told otherwise.
- **Never run a destructive or write query directly against production**
  during testing. The established safe pattern in this repo: wrap test SQL
  in `BEGIN; ... ROLLBACK;`, impersonate a user with
  `set_config('request.jwt.claim.sub', '<uuid>', true); set_config('role', 'authenticated', true);`,
  and log intermediate results into a `create temp table test_log (...)`
  (the SQL execution tool only returns the *last* statement's result set).
  **Always include the `ROLLBACK;` explicitly** — do not rely on an
  unclosed transaction being rolled back implicitly when the connection
  closes; verify it's clean with a row-count check afterward regardless.
- Financial, academic-integrity, and role-management writes go through
  **security-definer RPCs**, never raw table inserts from the client, even
  when RLS would technically allow it. Follow this pattern for new features.
- A fresh `CREATE FUNCTION` gets default PUBLIC-visible grants in Postgres.
  Every new function must end with
  `revoke execute ... from public, anon; grant execute ... to authenticated;`
  — revoking from `anon` alone is **not** sufficient (`anon` inherits
  through `PUBLIC`).
- `CREATE OR REPLACE FUNCTION` cannot change a parameter list — adding or
  removing a parameter silently creates a second overload instead of
  replacing the function. Use `DROP FUNCTION` (exact old signature) then
  `CREATE FUNCTION`, and re-apply the revoke/grant pair, since a dropped +
  recreated function does not inherit the old one's privileges.
- `auth_has_role()` and `is_verified_parent_of()` are the two central
  trust-boundary helpers — nearly every RLS policy in the schema calls one
  of them. Both also now check `profiles.is_active`. If you need to change
  what "has access" means system-wide, change these two functions, not each
  individual policy.
- Supabase grants `SELECT` on every new `public` table to `anon`/
  `authenticated` by default. If a table needs an RLS policy that calls a
  function already revoked from `anon` (like the two helpers above), an
  anon `SELECT` attempt fails with a *permission-denied-for-function* error
  rather than silently returning zero rows — functionally equivalent (no
  data leaks either way) but worth knowing when writing tests, and worth
  adding an explicit `revoke all on table ... from anon;` anyway so the
  boundary is declared in the table's own migration rather than depending
  on this incidental interaction (see migration 30).
- `admission_enquiries` is the first (and so far only) table with a
  function granted to `anon` at all (`submit_admission_enquiry`) — every
  other RPC in this schema is authenticated-only. If you add another
  genuinely-public write path, follow that migration's pattern: no RLS
  write policy for anyone, full validation + rate limiting inside the
  function itself, and nothing in its signature that could ever set a
  staff-only column.

## Roles and auth model

- Four roles exist today: `principal`, `accountant`, `teacher`, `parent` —
  enforced by a `CHECK` constraint on `user_roles.role`. There is **no
  student login/role** — `students` has no link to `auth.users`. Don't
  assume one exists; verify against the schema before building on top of
  "student accounts."
- A brand-new signup is granted **zero** roles by default. The only two
  ways a role is ever granted:
  1. `/register` (parent self-signup) — hardcoded `signup_source: "portal"`,
     consumed by the `handle_new_user` trigger to grant exactly `parent`.
  2. A principal-created `staff_invitations` row, consumed by the same
     trigger on signup, to grant `teacher`/`accountant` with a
     principal-chosen designation. Never trust client-supplied metadata for
     this — the trigger reads only the invitation row, never
     `raw_user_meta_data`.
- `assign_role` / `revoke_role` (principal-only RPCs) are the only way
  `user_roles` is ever written outside of the two paths above — there is no
  insert/update/delete RLS policy on `user_roles` at all, by design.
- `/login` is the one public entry point. `/admin/login` and `/portal/login`
  still exist only as redirects to `/login`, for old links.

## Conventions

- Money is integer minor units (paise) everywhere — see
  `src/lib/finance/money.ts`. Never introduce a float dollars/rupees field.
- Tables that are financial or audit-sensitive ledgers (`payments`,
  `refunds`, `salary_adjustments`, `parent_student_links`, ...) are
  append-only or correction-only — a "fix" is a new row or a status
  transition, never a delete or an in-place overwrite of history.
- `src/lib/supabase/types.ts` is hand-maintained, not generated — if you add
  or change a table/RPC signature in a migration, update this file in the
  same change, matching the existing style exactly.
- CSV export (`src/lib/export/csv.ts`) must keep neutralizing
  formula-injection trigger characters (`=+-@`, including after leading
  whitespace) — see the comments there before touching it.

## Before reporting a task done

Discover the actual npm scripts rather than assuming names (`npm run lint`,
`npm test -- --run`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run
build`). A passing build does not mean a feature is secure or correct —
state explicitly which claims are verified (tested, read in the actual RLS
policy) versus assumed.
