-- PREPARED FOR REVIEW — NOT YET APPLIED TO PRODUCTION.
--
-- Fixes two confirmed bugs in compute_results (migration 20261019_19):
--
-- 1. A rejected result had no path back to draft. approve_results and
--    reject_results only ever act on status = 'draft'; reopen_for_correction
--    only acts on ('approved', 'published'); and compute_results's upsert
--    never wrote to `status` at all. A rejected result was therefore a
--    permanent dead end, even after a teacher corrected the marks behind it.
--
-- 2. A student with an existing `results` row (draft or rejected) whose
--    marks were all deleted vanished from compute_results's per-student
--    loop entirely — the loop only ever enumerated students who currently
--    have marks rows — leaving that result's totals/status permanently
--    stale, with no way to reflect "zero marks now" and no way to
--    re-trigger review.
--
-- Fix for (1): adds `results.marks_fingerprint`, a deterministic digest of
-- a student's actual per-subject marks (subject_id, raw_score, max_score —
-- not the total, not a timestamp). A rejected result only returns to draft
-- when this fingerprint demonstrably differs from a known prior baseline:
--   - Two marks can swap values and leave the total identical — comparing
--     totals alone would miss this, so the fingerprint is per-subject.
--   - The marks-entry UI (src/admin/features/marks/MarkEntryPage.tsx,
--     saveMark()) issues an unconditional UPDATE on every save, even when
--     the value hasn't changed — so a touched/updated_at-timestamp-based
--     signal would false-positive on a no-op save. The fingerprint is
--     value-based, not touch-based.
--   - A legacy rejected row with marks_fingerprint = null (no baseline —
--     every row created before this migration) gets one established
--     silently the first time compute_results next visits it: status,
--     rejection_reason, and results_audit are all left untouched, because
--     the absence of a baseline is not evidence that anything changed.
--     From that point on it behaves exactly like a freshly-rejected row.
--
-- Fix for (2): the per-student loop now enumerates every student who either
-- has marks in this term OR an existing results row for it (a UNION of
-- both), left-joining marks so a zero-marks student is still visited, with
-- obtained = 0, max_total = 0, and the same fingerprint (md5('')) used
-- everywhere else in this function to mean "no marks".
--
-- Approved/published results are untouched by either fix: the existing
-- `continue` guard still runs first, unconditionally, before any of this
-- new logic — and is now additionally re-checked atomically at write time
-- via GET DIAGNOSTICS ... ROW_COUNT, so a concurrent approve/publish
-- landing between this function's read and its write can never be
-- silently overwritten, and can never produce an incorrect audit row.
-- Deleting marks for an approved/published student is not actually
-- reachable in production: marks_write_teacher / marks_write_principal
-- (both `for all`, so including delete) already deny any write once a
-- student's result for that term is approved or published (migrations
-- 20261019_20_rls_results.sql, 20261021_31_lock_marks_after_approval.sql) —
-- unaffected and unweakened by this migration.
--
-- No RLS policy, grant, or any function other than compute_results is
-- touched. compute_results keeps its exact existing signature
-- (p_exam_term_id uuid) -> int, so `create or replace` is safe and grants
-- carry forward unchanged; the revoke/grant pair below just restates them
-- explicitly for clarity.
--
-- Rollback: `alter table public.results drop column marks_fingerprint;`
-- and restore the compute_results body verbatim from
-- 20261019_19_results.sql (no grant changes needed either way).

alter table public.results add column marks_fingerprint text;

create or replace function public.compute_results(p_exam_term_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year_id uuid;
  v_staff_id uuid;
  v_affected int := 0;
  v_rows_affected int;
  v_student record;
  v_total_obtained numeric;
  v_total_max numeric;
  v_percentage numeric;
  v_grade text;
  v_result_id uuid;
  v_current_status text;
  v_stored_fingerprint text;
  v_new_fingerprint text;
begin
  if not public.auth_has_role('principal') then
    raise exception 'only the principal may compute results';
  end if;
  v_staff_id := public.current_staff_id();

  select academic_year_id into v_year_id from public.exam_terms where id = p_exam_term_id;

  -- Enumerates every student who either has marks in this term, or already
  -- has a results row for it — so a student whose marks were all deleted
  -- is still visited instead of silently vanishing from this loop. Totals
  -- and the fingerprint both come from this single query per student, so a
  -- concurrent edit can never make them describe different snapshots of
  -- `marks`.
  --
  -- raw_score/max_score are declared as plain, unconstrained `numeric`
  -- (migration 20261019_17 — no fixed precision/scale), so rounding to a
  -- fixed number of decimal places (e.g. round(x, 4)) could silently
  -- collapse two genuinely different values into the same fingerprint if a
  -- future caller ever stores more precision than that. trim_scale() (PG13+;
  -- this project runs PG17) avoids that entirely: it only removes trailing
  -- zero digits from a value's display scale — "40" and "40.0" and "40.00"
  -- all normalize to the single canonical text "40" (fixing the actual
  -- formatting-ambiguity problem this is meant to solve), while two values
  -- that differ at any decimal depth still normalize to different text, no
  -- matter how many decimal places are involved. Lossless, unlike round().
  --
  -- raw_score/max_score are `not null` at the column level, so the only way
  -- this fingerprint expression is ever null is "zero marks rows", handled
  -- by the outer coalesce.
  for v_student in
    select u.student_id,
           coalesce(sum(m.raw_score), 0) as obtained,
           coalesce(sum(m.max_score), 0) as max_total,
           md5(coalesce(
             string_agg(m.subject_id::text || ':' || trim_scale(m.raw_score)::text || ':' || trim_scale(m.max_score)::text,
                        ',' order by m.subject_id),
             '')) as fingerprint
    from (
      select student_id from public.marks where exam_term_id = p_exam_term_id
      union
      select student_id from public.results where exam_term_id = p_exam_term_id
    ) u
    left join public.marks m
      on m.student_id = u.student_id and m.exam_term_id = p_exam_term_id
    group by u.student_id
  loop
    select id, status, marks_fingerprint
      into v_result_id, v_current_status, v_stored_fingerprint
    from public.results
    where student_id = v_student.student_id and exam_term_id = p_exam_term_id;

    if v_current_status in ('approved', 'published') then
      continue;
    end if;

    v_total_obtained := v_student.obtained;
    v_total_max := v_student.max_total;
    v_percentage := case when v_total_max > 0 then (v_total_obtained / v_total_max) * 100 else null end;
    v_new_fingerprint := v_student.fingerprint;

    -- PL/pgSQL's single-row SELECT INTO already assigns NULL here on zero
    -- matches (documented behavior, verified — not assumed), so this reset
    -- is defensive/readability only, not a correctness fix: a reader
    -- shouldn't have to know that subtlety to trust that a zero-marks
    -- student never inherits a grade left over from a previous iteration.
    v_grade := null;
    select grade_label into v_grade
    from public.grade_scale
    where academic_year_id = v_year_id
      and v_percentage >= min_percent and v_percentage <= max_percent
    limit 1;

    if v_current_status = 'rejected' then
      if v_stored_fingerprint is null then
        -- Legacy row, no baseline yet: refresh totals/grade (already
        -- happens for rejected rows in production today — the pre-fix
        -- `continue` only ever excluded approved/published) and record
        -- this fingerprint as the starting point. No status change, no
        -- reason cleared, no audit row — we have no evidence of a change,
        -- only the absence of a prior baseline to compare against.
        update public.results
        set total_obtained = v_total_obtained,
            total_max = v_total_max,
            percentage = v_percentage,
            overall_grade = v_grade,
            marks_fingerprint = v_new_fingerprint
        where id = v_result_id and status = 'rejected';
        continue;
      elsif v_stored_fingerprint = v_new_fingerprint then
        -- Known baseline, confirmed unchanged (including the "still zero
        -- marks" case): leave entirely untouched.
        continue;
      end if;
      -- Else: known baseline, and it differs — evidenced change. Falls
      -- through to the upsert below, which returns it to draft.
    end if;

    insert into public.results
      (student_id, exam_term_id, total_obtained, total_max, percentage, overall_grade, status, marks_fingerprint)
    values
      (v_student.student_id, p_exam_term_id, v_total_obtained, v_total_max, v_percentage, v_grade, 'draft', v_new_fingerprint)
    on conflict (student_id, exam_term_id) do update
      set total_obtained = excluded.total_obtained,
          total_max = excluded.total_max,
          percentage = excluded.percentage,
          overall_grade = excluded.overall_grade,
          status = 'draft',
          rejection_reason = null,
          marks_fingerprint = excluded.marks_fingerprint
      -- Defense in depth: the `continue` above already guarantees we only
      -- reach here when the existing row is 'draft' or 'rejected'. This
      -- WHERE re-checks the CURRENT row atomically at write time, so a
      -- concurrent approve/publish between our read and this write can
      -- never be silently overwritten.
      where public.results.status in ('draft', 'rejected');

    get diagnostics v_rows_affected = row_count;

    if v_rows_affected > 0 then
      if v_current_status = 'rejected' then
        insert into public.results_audit (result_id, old_status, new_status, changed_by, note)
        values (v_result_id, 'rejected', 'draft', v_staff_id,
                'Returned to draft automatically: underlying marks changed after rejection (fingerprint mismatch against stored baseline).');
      end if;
      v_affected := v_affected + 1;
    end if;
  end loop;

  return v_affected;
end;
$$;

revoke execute on function public.compute_results(uuid) from public, anon;
grant execute on function public.compute_results(uuid) to authenticated;
