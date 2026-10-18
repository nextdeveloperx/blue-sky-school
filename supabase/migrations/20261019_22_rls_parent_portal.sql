alter table public.parents enable row level security;
alter table public.parent_student_links enable row level security;

-- parents: a parent reads/updates only their own row; staff can read all
-- (needed when reviewing link requests and cross-checking guardians).
create policy parents_select on public.parents
  for select using (
    profile_id = auth.uid()
    or public.auth_has_role('principal') or public.auth_has_role('accountant')
  );
create policy parents_update_own on public.parents
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- parent_student_links: parent reads their own links (any status, so they
-- see "pending"); staff read all. No direct update/delete policy for
-- anyone — review_link_request (security definer) is the only status
-- writer. A parent MAY insert their own pending request directly (the RPC
-- does the same thing via a friendlier generic-response API, but either
-- path is fine since the insert itself can only ever create a 'pending'
-- row — verification_status has no caller-settable path to 'verified').
create policy parent_student_links_select on public.parent_student_links
  for select using (
    exists (select 1 from public.parents p where p.id = parent_student_links.parent_id and p.profile_id = auth.uid())
    or public.auth_has_role('principal') or public.auth_has_role('accountant')
  );

create policy parent_student_links_insert_own on public.parent_student_links
  for insert with check (
    verification_status = 'pending'
    and exists (select 1 from public.parents p where p.id = parent_student_links.parent_id and p.profile_id = auth.uid())
  );

revoke execute on function public.request_student_link(text, text) from public, anon;
grant execute on function public.request_student_link(text, text) to authenticated;
revoke execute on function public.review_link_request(uuid, text) from public, anon;
grant execute on function public.review_link_request(uuid, text) to authenticated;
revoke execute on function public.is_verified_parent_of(uuid) from public, anon;
grant execute on function public.is_verified_parent_of(uuid) to authenticated;

-- Extend parent read access (published-only / own-verified-children-only)
-- onto the tables that matter to a parent: results, fee_schedules, payments.
create policy results_select_parent on public.results
  for select using (
    public.is_verified_parent_of(results.student_id) and results.status = 'published'
  );

create policy fee_schedules_select_parent on public.fee_schedules
  for select using (public.is_verified_parent_of(fee_schedules.student_id));

create policy payments_select_parent on public.payments
  for select using (public.is_verified_parent_of(payments.student_id));
