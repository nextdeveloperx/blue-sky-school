# Blue Sky School

Public marketing site **and** School Management System (SMS) for Blue Sky
School, built with React, TypeScript, Vite, and Supabase (Postgres + Auth +
Row Level Security).

Live: [blue-sky-school.vercel.app](https://blue-sky-school.vercel.app)

## What's in this repo

- **Public site** (`/`, `/about`, `/academics`, `/admissions`, `/gallery`,
  `/contact`) — the marketing pages, unauthenticated.
- **Unified login** (`/login`) — one sign-in form for every account type.
  After authentication, the signed-in user's role is resolved from the
  database (`user_roles`, RLS-scoped) and they're redirected automatically —
  there is no role picker. `/register` is the only public self-registration
  route, and it only ever creates a **parent** account.
- **Admin app** (`/admin/*`) — principal, accountant, and teacher
  dashboards: academic setup, students, staff & role management, teacher
  assignments, fees, payments & refunds, payroll, exams, marks, results,
  parent-link verification, expenses, exports, and the audit log. Access is
  gated client-side by `RequireRole` for UX and, for real, by Postgres RLS.
- **Family dashboard** (`/portal/*`, internal route name kept for backward
  compatibility) — the parent-facing experience: linked children, published
  results, fee dues, and payment history. A parent only ever sees their own
  **verified** children, enforced by RLS, not just the UI.
- **Supabase backend** (`supabase/migrations/`) — every table, RLS policy,
  and security-definer RPC the app depends on. Financial, academic, and
  role-management writes all go through RPCs, never raw inserts, so
  invariants (idempotency, one-active-assignment-at-a-time, audit logging)
  are enforced in the database, not just in React.
- **Admissions enquiries** — a public enquiry form on `/admissions` and a
  principal/accountant-only management view at `/admin/enquiries`. See
  "Admissions enquiry workflow" below.

## Admissions enquiry workflow

A visitor submits the form on `/admissions` with no account — the only RPC
in this schema callable by `anon`, `submit_admission_enquiry` (migration
`20261020_30_admission_enquiries.sql`), does all validation, honeypot
spam-checking, and real server-side rate limiting (by phone/email always,
and by IP when the request-headers GUC is present) before inserting a row.
There is no INSERT/UPDATE/DELETE RLS policy for anyone, including the
principal — that RPC and `update_enquiry` (authenticated-only) are the only
writers. The principal sees every enquiry; an accountant sees only
enquiries explicitly assigned to them (`/admin/enquiries`, also wired into
the admin sidebar). Status changes, assignment, and notes go through
`update_enquiry`, audited by the same generic trigger already used for
payments/payroll/parent links.

**No email/SMS notification is sent on submission or status change** — no
such service is configured in this project (checked: no Edge Functions
directory, no email-provider package, nothing in `.env.example`). To add
one later: create a Supabase Edge Function triggered by a database webhook
on `admission_enquiries` INSERT, call an email API (e.g. Resend) from it,
and set its API key as a Supabase Edge Function secret — never as a
`VITE_`-prefixed variable, since those ship into the browser bundle.

## Tech Stack

- Vite, TypeScript, React, React Router
- shadcn-ui, Tailwind CSS, Framer Motion
- Supabase (`@supabase/supabase-js`) — Postgres, Auth, RLS, security-definer
  RPCs
- React Query, React Hook Form + Zod
- Vitest + Testing Library

## Getting Started

```sh
# Clone the repository
git clone https://github.com/nextdeveloperx/blue-sky-school.git
cd blue-sky-school

# Install dependencies
npm i

# Configure Supabase
cp .env.example .env
# then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Start the development server
npm run dev
```

The public marketing pages work with no Supabase configuration. Any
`/admin`, `/portal`, `/login`, or `/register` route needs a configured
Supabase project with all migrations in `supabase/migrations/` applied, in
filename order.

## Available Scripts

- `npm run dev` — start the development server
- `npm run build` — build for production
- `npm run build:dev` — build in development mode
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint
- `npm run test` — run the test suite
- `npm run test:watch` — run tests in watch mode

## Database migrations

Migrations in `supabase/migrations/` are plain SQL, applied in filename
order (the timestamp prefix is the order, not a date you can reorder by).
Each one is self-documenting — read the comment block at the top of a
migration before applying it; several explain a specific security property
they establish (e.g. idempotency keys, concurrency guards, RLS policies)
and why. Apply new migrations to a Supabase project via the dashboard SQL
editor, the Supabase CLI, or the Supabase MCP tooling — never by hand-typing
schema changes directly against production.
