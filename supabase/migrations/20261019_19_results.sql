-- Results: per-student-per-term rollup with a draft -> approved -> published
-- (or -> rejected -> back to draft) lifecycle. The principal alone approves
-- and publishes (finalized requirement), via security-definer RPCs —
-- results/results_audit have no direct insert/update policy for anyone.

create table public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  exam_term_id uuid not null references public.exam_terms (id),
  total_obtained numeric,
  total_max numeric,
  percentage numeric,
  overall_grade text,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'published', 'rejected')),
  approved_by uuid references public.staff (id),
  approved_at timestamptz,
  published_at timestamptz,
  rejection_reason text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  unique (student_id, exam_term_id)
);

create table public.results_audit (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.results (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid not null references public.staff (id),
  changed_at timestamptz not null default now(),
  note text
);

-- Recomputes draft totals for every student with marks in this term. Never
-- touches a result that is already approved/published (a per-student lock,
-- not a blanket per-term freeze) — re-running after a reopen_for_correction
-- picks that student back up once their result is back to draft.
create function public.compute_results(p_exam_term_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year_id uuid;
  v_affected int := 0;
  v_student record;
  v_total_obtained numeric;
  v_total_max numeric;
  v_percentage numeric;
  v_grade text;
  v_result_id uuid;
  v_current_status text;
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may compute results';
  end if;

  select academic_year_id into v_year_id from public.exam_terms where id = p_exam_term_id;

  for v_student in
    select student_id, sum(raw_score) as obtained, sum(max_score) as max_total
    from public.marks
    where exam_term_id = p_exam_term_id
    group by student_id
  loop
    select id, status into v_result_id, v_current_status
    from public.results
    where student_id = v_student.student_id and exam_term_id = p_exam_term_id;

    if v_current_status in ('approved', 'published') then
      continue;
    end if;

    v_total_obtained := v_student.obtained;
    v_total_max := v_student.max_total;
    v_percentage := case when v_total_max > 0 then (v_total_obtained / v_total_max) * 100 else null end;

    select grade_label into v_grade
    from public.grade_scale
    where academic_year_id = v_year_id
      and v_percentage >= min_percent and v_percentage <= max_percent
    limit 1;

    insert into public.results
      (student_id, exam_term_id, total_obtained, total_max, percentage, overall_grade, status)
    values
      (v_student.student_id, p_exam_term_id, v_total_obtained, v_total_max, v_percentage, v_grade, 'draft')
    on conflict (student_id, exam_term_id) do update
      set total_obtained = excluded.total_obtained,
          total_max = excluded.total_max,
          percentage = excluded.percentage,
          overall_grade = excluded.overall_grade;

    v_affected := v_affected + 1;
  end loop;

  return v_affected;
end;
$$;

create function public.approve_results(p_result_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_count int;
  v_id uuid;
  v_old_status text;
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may approve results';
  end if;
  v_staff_id := public.current_staff_id();

  v_count := 0;
  foreach v_id in array p_result_ids loop
    select status into v_old_status from public.results where id = v_id;
    if v_old_status = 'draft' then
      update public.results
      set status = 'approved', approved_by = v_staff_id, approved_at = now()
      where id = v_id;
      insert into public.results_audit (result_id, old_status, new_status, changed_by)
      values (v_id, v_old_status, 'approved', v_staff_id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create function public.reject_results(p_result_ids uuid[], p_reason text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_count int;
  v_id uuid;
  v_old_status text;
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may reject results';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required to reject results';
  end if;
  v_staff_id := public.current_staff_id();

  v_count := 0;
  foreach v_id in array p_result_ids loop
    select status into v_old_status from public.results where id = v_id;
    if v_old_status = 'draft' then
      update public.results
      set status = 'rejected', rejection_reason = p_reason
      where id = v_id;
      insert into public.results_audit (result_id, old_status, new_status, changed_by, note)
      values (v_id, v_old_status, 'rejected', v_staff_id, p_reason);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create function public.publish_results(p_result_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_count int;
  v_id uuid;
  v_old_status text;
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may publish results';
  end if;
  v_staff_id := public.current_staff_id();

  v_count := 0;
  foreach v_id in array p_result_ids loop
    select status into v_old_status from public.results where id = v_id;
    if v_old_status = 'approved' then
      update public.results
      set status = 'published', published_at = now()
      where id = v_id;
      insert into public.results_audit (result_id, old_status, new_status, changed_by)
      values (v_id, v_old_status, 'published', v_staff_id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Post-publish correction is never a silent edit: this is the only way a
-- published (or approved) result goes back to draft, and it's logged with
-- a reason. The "last updated" timestamp from this audit row is what makes
-- a later re-publish visibly a correction to anyone reading results_audit.
create function public.reopen_for_correction(p_result_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_old_status text;
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may reopen a result for correction';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required to reopen a result';
  end if;
  v_staff_id := public.current_staff_id();

  select status into v_old_status from public.results where id = p_result_id;
  if v_old_status not in ('approved', 'published') then
    raise exception 'only an approved or published result can be reopened';
  end if;

  update public.results
  set status = 'draft', version = version + 1
  where id = p_result_id;

  insert into public.results_audit (result_id, old_status, new_status, changed_by, note)
  values (p_result_id, v_old_status, 'draft', v_staff_id, p_reason);
end;
$$;
