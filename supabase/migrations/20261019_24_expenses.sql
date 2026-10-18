-- School expenses — a core module from the original requirements that was
-- dropped when the task list got restructured around the expanded
-- academics/parent-portal spec. Adding it now, before exports (M9) need
-- something to export for the expenses category.

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories (id),
  amount_minor bigint not null check (amount_minor > 0),
  incurred_on date not null,
  description text,
  recorded_by uuid not null references public.staff (id),
  receipt_ref text,
  created_at timestamptz not null default now()
);

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

create policy expense_categories_select on public.expense_categories
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));
create policy expense_categories_write on public.expense_categories
  for all using (public.auth_has_role('principal') or public.auth_has_role('accountant'))
  with check (public.auth_has_role('principal') or public.auth_has_role('accountant'));

create policy expenses_select on public.expenses
  for select using (public.auth_has_role('principal') or public.auth_has_role('accountant'));
create policy expenses_write on public.expenses
  for all using (public.auth_has_role('principal') or public.auth_has_role('accountant'))
  with check (public.auth_has_role('principal') or public.auth_has_role('accountant'));
