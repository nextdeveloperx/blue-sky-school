-- Regression test for supabase/migrations/20261025_33_fix_rejected_results_recompute.sql
--
-- NOT EXECUTED by the assistant. Prepared for review only.
--
-- This script is entirely self-contained: it creates its own throwaway
-- academic year, class, section, subjects, exam term, grade scale, staff
-- (principal/teacher/accountant), and students inside one transaction, then
-- rolls everything back at the end. It does not read or depend on any real
-- demo or production data, and leaves no trace once rolled back.
--
-- Run it only against a local Postgres instance restored from a backup, or
-- a disposable Supabase branch created specifically for this — never
-- against the live production project. Per CLAUDE.md's own sanctioned
-- pattern for this repo: wrap in BEGIN/ROLLBACK, impersonate via
-- set_config('request.jwt.claim.sub', ...) + set_config('role',
-- 'authenticated', ...), and verify cleanliness with a separate read-only
-- row-count check after the rollback completes.
--
-- Known environment dependency: the `insert into auth.users (...)` block
-- below lists the columns this repo's Supabase project (Postgres 17,
-- `auth` schema as of 2026-10-25) is expected to require. Supabase's
-- `auth.users` schema can differ slightly by project/version — if this
-- script fails on that insert, adjust the column list to match the actual
-- `auth.users` schema in the target environment before re-running; nothing
-- else in this script should need to change.
--
-- Apply the migration itself first (in the SAME disposable/local database,
-- never production), then run this script there.

begin;

create temp table test_log (
  seq serial primary key,
  scenario text not null,
  passed boolean not null,
  detail text
);

do $test$
declare
  v_principal_user uuid := gen_random_uuid();
  v_teacher_user uuid := gen_random_uuid();
  v_accountant_user uuid := gen_random_uuid();
  v_principal_staff uuid;
  v_teacher_staff uuid;
  v_accountant_staff uuid;
  v_year uuid;
  v_class uuid;
  v_section uuid;
  v_subject1 uuid;
  v_subject2 uuid;
  v_term uuid;
  v_student_a uuid; -- rejected, known baseline, correction changes the total
  v_student_b uuid; -- rejected, known baseline, correction keeps the total identical
  v_student_c uuid; -- rejected, known baseline, genuinely unchanged
  v_student_d uuid; -- rejected, legacy null baseline
  v_student_e uuid; -- draft
  v_student_f uuid; -- approved
  v_student_g uuid; -- published
  v_student_h uuid; -- rejected, known baseline, all marks later deleted
  v_result_a uuid;
  v_result_b uuid;
  v_result_c uuid;
  v_result_d uuid;
  v_result_e uuid;
  v_result_f uuid;
  v_result_g uuid;
  v_result_h uuid;
  v_row public.results;
  v_original_role text;
  v_run_suffix text := substr(gen_random_uuid()::text, 1, 8);
begin
  v_original_role := current_setting('role');
  ----------------------------------------------------------------------
  -- Fixtures (run as the script's own elevated role, before any
  -- set_config('role', 'authenticated', ...) call, so RLS does not apply
  -- to this setup — it is not simulating a user action, just preparing
  -- throwaway state).
  ----------------------------------------------------------------------
  -- Do NOT also insert into public.profiles here: the AFTER INSERT trigger
  -- `handle_new_user` (migration 20261019_29_staff_invitations_and_role_
  -- revocation.sql) fires automatically on this auth.users insert and
  -- already creates a matching public.profiles row for every new user
  -- (full_name defaults to '' via coalesce, email comes from new.email). A
  -- second explicit insert here would violate profiles' primary key. The
  -- same trigger also checks staff_invitations and raw_user_meta_data's
  -- signup_source — neither matches anything for these throwaway emails,
  -- so no staff/parent/user_roles row is created on our behalf; the
  -- explicit inserts below are the only source of those.
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  values
    (v_principal_user,  'test-principal-' || v_principal_user || '@example.invalid',  '', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_teacher_user,    'test-teacher-' || v_teacher_user || '@example.invalid',      '', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_accountant_user, 'test-accountant-' || v_accountant_user || '@example.invalid','', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.staff (profile_id, designation) values (v_principal_user, 'Principal') returning id into v_principal_staff;
  insert into public.staff (profile_id, designation) values (v_teacher_user, 'Teacher') returning id into v_teacher_staff;
  insert into public.staff (profile_id, designation) values (v_accountant_user, 'Accountant') returning id into v_accountant_staff;

  insert into public.user_roles (user_id, role) values
    (v_principal_user, 'principal'),
    (v_teacher_user, 'teacher'),
    (v_accountant_user, 'accountant');

  insert into public.academic_years (label, start_date, end_date, is_current)
  values ('TEST-YEAR-' || gen_random_uuid()::text, '2026-06-01', '2027-03-31', false)
  returning id into v_year;

  insert into public.classes (academic_year_id, name) values (v_year, 'Test Class') returning id into v_class;
  insert into public.sections (class_id, name, class_teacher_staff_id)
    values (v_class, 'Test Section', v_teacher_staff) returning id into v_section;
  insert into public.subjects (academic_year_id, name) values (v_year, 'Test Subject 1') returning id into v_subject1;
  insert into public.subjects (academic_year_id, name) values (v_year, 'Test Subject 2') returning id into v_subject2;
  insert into public.exam_terms (academic_year_id, name) values (v_year, 'Test Term') returning id into v_term;
  insert into public.grade_scale (academic_year_id, min_percent, max_percent, grade_label)
    values (v_year, 0, 100, 'A');

  insert into public.teacher_subject_assignments (academic_year_id, section_id, subject_id, teacher_staff_id)
  values (v_year, v_section, v_subject1, v_teacher_staff), (v_year, v_section, v_subject2, v_teacher_staff);

  -- admission_no is globally unique (not scoped to academic_year_id), so
  -- every value is suffixed with this run's own random marker — collision-
  -- proof against any pre-existing demo/test data and against this script
  -- being run more than once against a long-lived disposable database.
  insert into public.students (admission_no, full_name, academic_year_id, current_section_id)
    values ('TEST-A-' || v_run_suffix, 'Student A', v_year, v_section) returning id into v_student_a;
  insert into public.students (admission_no, full_name, academic_year_id, current_section_id)
    values ('TEST-B-' || v_run_suffix, 'Student B', v_year, v_section) returning id into v_student_b;
  insert into public.students (admission_no, full_name, academic_year_id, current_section_id)
    values ('TEST-C-' || v_run_suffix, 'Student C', v_year, v_section) returning id into v_student_c;
  insert into public.students (admission_no, full_name, academic_year_id, current_section_id)
    values ('TEST-D-' || v_run_suffix, 'Student D', v_year, v_section) returning id into v_student_d;
  insert into public.students (admission_no, full_name, academic_year_id, current_section_id)
    values ('TEST-E-' || v_run_suffix, 'Student E', v_year, v_section) returning id into v_student_e;
  insert into public.students (admission_no, full_name, academic_year_id, current_section_id)
    values ('TEST-F-' || v_run_suffix, 'Student F', v_year, v_section) returning id into v_student_f;
  insert into public.students (admission_no, full_name, academic_year_id, current_section_id)
    values ('TEST-G-' || v_run_suffix, 'Student G', v_year, v_section) returning id into v_student_g;
  insert into public.students (admission_no, full_name, academic_year_id, current_section_id)
    values ('TEST-H-' || v_run_suffix, 'Student H', v_year, v_section) returning id into v_student_h;

  -- Every student starts with the same two marks: 40/50 and 40/50 (total 80/100).
  insert into public.marks (student_id, section_id, subject_id, exam_term_id, raw_score, max_score, entered_by)
  select s.id, v_section, subj.id, v_term, 40, 50, v_teacher_staff
  from (values (v_student_a),(v_student_b),(v_student_c),(v_student_d),(v_student_e),(v_student_f),(v_student_g),(v_student_h)) as s(id)
  cross join (values (v_subject1),(v_subject2)) as subj(id);

  ----------------------------------------------------------------------
  -- Impersonate the principal for the rest of the script, per CLAUDE.md's
  -- established test-impersonation pattern.
  ----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_principal_user::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.compute_results(v_term);

  select id into v_result_a from public.results where student_id = v_student_a and exam_term_id = v_term;
  select id into v_result_b from public.results where student_id = v_student_b and exam_term_id = v_term;
  select id into v_result_c from public.results where student_id = v_student_c and exam_term_id = v_term;
  select id into v_result_d from public.results where student_id = v_student_d and exam_term_id = v_term;
  select id into v_result_e from public.results where student_id = v_student_e and exam_term_id = v_term;
  select id into v_result_f from public.results where student_id = v_student_f and exam_term_id = v_term;
  select id into v_result_g from public.results where student_id = v_student_g and exam_term_id = v_term;
  select id into v_result_h from public.results where student_id = v_student_h and exam_term_id = v_term;

  perform public.reject_results(array[v_result_a, v_result_b, v_result_c, v_result_h], 'test rejection');
  perform public.approve_results(array[v_result_f, v_result_g]);
  perform public.publish_results(array[v_result_g]);

  -- Fabricate the exact legacy condition this migration is designed for:
  -- a rejected row with no stored fingerprint, because it predates the
  -- migration. (A real row in this state cannot otherwise exist once the
  -- column exists, since every future rejection is preceded by at least
  -- one draft-stage compute_results call that populates it.)
  update public.results set marks_fingerprint = null where id = v_result_d;

  ----------------------------------------------------------------------
  -- Scenario 1: corrected marks, total changes
  ----------------------------------------------------------------------
  update public.marks set raw_score = 45 where student_id = v_student_a and subject_id = v_subject1;
  perform public.compute_results(v_term);

  select * into v_row from public.results where id = v_result_a;
  insert into test_log (scenario, passed, detail) values (
    'S1: corrected marks with changed total -> draft, reason cleared, total updated',
    v_row.status = 'draft' and v_row.rejection_reason is null and v_row.total_obtained = 85,
    format('status=%s reason=%s total=%s', v_row.status, v_row.rejection_reason, v_row.total_obtained)
  );
  insert into test_log (scenario, passed, detail)
  select 'S1: exactly one rejected->draft audit row', count(*) = 1, format('count=%s', count(*))
  from public.results_audit where result_id = v_result_a and old_status = 'rejected' and new_status = 'draft';

  ----------------------------------------------------------------------
  -- Scenario 2: corrected marks, total stays identical (40/50+40/50=80 -> 30/50+50/50=80)
  ----------------------------------------------------------------------
  update public.marks set raw_score = 30 where student_id = v_student_b and subject_id = v_subject1;
  update public.marks set raw_score = 50 where student_id = v_student_b and subject_id = v_subject2;
  perform public.compute_results(v_term);

  select * into v_row from public.results where id = v_result_b;
  insert into test_log (scenario, passed, detail) values (
    'S2: corrected marks with the SAME total -> still returns to draft',
    v_row.status = 'draft' and v_row.rejection_reason is null and v_row.total_obtained = 80,
    format('status=%s reason=%s total=%s', v_row.status, v_row.rejection_reason, v_row.total_obtained)
  );

  ----------------------------------------------------------------------
  -- Scenario 3: rejected, marks genuinely untouched -> stays rejected
  ----------------------------------------------------------------------
  perform public.compute_results(v_term);

  select * into v_row from public.results where id = v_result_c;
  insert into test_log (scenario, passed, detail) values (
    'S3: rejected result with unchanged marks stays rejected, no writes',
    v_row.status = 'rejected' and v_row.rejection_reason = 'test rejection',
    format('status=%s reason=%s', v_row.status, v_row.rejection_reason)
  );
  insert into test_log (scenario, passed, detail)
  select 'S3: no audit row for an unchanged rejected result', count(*) = 0, format('count=%s', count(*))
  from public.results_audit where result_id = v_result_c and new_status = 'draft';

  ----------------------------------------------------------------------
  -- Scenario 4: no-op resave (same value written back) must NOT look like a change
  ----------------------------------------------------------------------
  update public.marks set raw_score = raw_score where student_id = v_student_c and subject_id = v_subject1;
  perform public.compute_results(v_term);

  select * into v_row from public.results where id = v_result_c;
  insert into test_log (scenario, passed, detail) values (
    'S4: a no-op resave of an identical value does not un-reject the result',
    v_row.status = 'rejected',
    format('status=%s', v_row.status)
  );

  ----------------------------------------------------------------------
  -- Scenario 5: legacy NULL fingerprint — first encounter establishes a
  -- baseline silently, with no status/reason/audit change.
  ----------------------------------------------------------------------
  perform public.compute_results(v_term);

  select * into v_row from public.results where id = v_result_d;
  insert into test_log (scenario, passed, detail) values (
    'S5: legacy NULL-fingerprint rejected row stays rejected on first touch; baseline recorded',
    v_row.status = 'rejected' and v_row.rejection_reason is not null and v_row.marks_fingerprint is not null,
    format('status=%s reason=%s fingerprint_is_null=%s', v_row.status, v_row.rejection_reason, v_row.marks_fingerprint is null)
  );
  insert into test_log (scenario, passed, detail)
  select 'S5: establishing a legacy baseline writes no audit row', count(*) = 0, format('count=%s', count(*))
  from public.results_audit where result_id = v_result_d and new_status = 'draft';

  ----------------------------------------------------------------------
  -- Scenario 5b: that same legacy row, now with a real baseline, is
  -- genuinely corrected afterward -> must transition like any other row.
  ----------------------------------------------------------------------
  update public.marks set raw_score = 45 where student_id = v_student_d and subject_id = v_subject1;
  perform public.compute_results(v_term);

  select * into v_row from public.results where id = v_result_d;
  insert into test_log (scenario, passed, detail) values (
    'S5b: legacy row transitions normally once a real change happens after its baseline exists',
    v_row.status = 'draft' and v_row.rejection_reason is null,
    format('status=%s reason=%s', v_row.status, v_row.rejection_reason)
  );

  ----------------------------------------------------------------------
  -- Scenario 6: plain draft recomputation is unaffected by any of this
  ----------------------------------------------------------------------
  update public.marks set raw_score = 42 where student_id = v_student_e and subject_id = v_subject1;
  perform public.compute_results(v_term);

  select * into v_row from public.results where id = v_result_e;
  insert into test_log (scenario, passed, detail) values (
    'S6: draft result recomputes totals normally',
    v_row.status = 'draft' and v_row.total_obtained = 82,
    format('status=%s total=%s', v_row.status, v_row.total_obtained)
  );
  insert into test_log (scenario, passed, detail)
  select 'S6: ordinary draft recompute writes no audit row', count(*) = 0, format('count=%s', count(*))
  from public.results_audit where result_id = v_result_e;

  ----------------------------------------------------------------------
  -- Scenario 7/8: approved/published protection, including against a
  -- marks edit that happens anyway (RLS already blocks this in the real
  -- app for any role; this isolates compute_results' OWN defense-in-depth
  -- by performing the edit as the table owner, bypassing RLS, specifically
  -- to prove compute_results itself still refuses these rows even if some
  -- other bug ever let a locked mark through).
  ----------------------------------------------------------------------
  -- Temporarily restore the script's own original role, bypassing RLS, for
  -- this one deliberate test-isolation step only (see comment above).
  perform set_config('role', v_original_role, true);
  update public.marks set raw_score = 1 where student_id = v_student_f and subject_id = v_subject1;
  update public.marks set raw_score = 1 where student_id = v_student_g and subject_id = v_subject1;
  perform set_config('request.jwt.claim.sub', v_principal_user::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.compute_results(v_term);

  -- F and G were never touched before this point: original fixture marks
  -- were 40/50 + 40/50 per student, so total_obtained must still be 80 —
  -- NOT whatever compute_results would produce from the just-edited
  -- raw_score=1 (which would be 41/100 if the lock ever failed).
  select * into v_row from public.results where id = v_result_f;
  insert into test_log (scenario, passed, detail) values (
    'S7: approved result is fully unaffected even if its marks are edited',
    v_row.status = 'approved' and v_row.total_obtained = 80,
    format('status=%s total=%s', v_row.status, v_row.total_obtained)
  );

  select * into v_row from public.results where id = v_result_g;
  insert into test_log (scenario, passed, detail) values (
    'S8: published result is fully unaffected even if its marks are edited',
    v_row.status = 'published' and v_row.total_obtained = 80,
    format('status=%s total=%s', v_row.status, v_row.total_obtained)
  );
  insert into test_log (scenario, passed, detail)
  select 'S7/S8: no audit rows written for approved/published', count(*) = 0, format('count=%s', count(*))
  from public.results_audit where result_id in (v_result_f, v_result_g) and new_status = 'draft';

  ----------------------------------------------------------------------
  -- Scenario 9: repeated recomputation never duplicates a transition audit row
  ----------------------------------------------------------------------
  perform public.compute_results(v_term);
  insert into test_log (scenario, passed, detail)
  select 'S9: repeat recompute does not duplicate the audit row (Student A)', count(*) = 1, format('count=%s', count(*))
  from public.results_audit where result_id = v_result_a and old_status = 'rejected' and new_status = 'draft';
  insert into test_log (scenario, passed, detail)
  select 'S9: repeat recompute does not duplicate the audit row (Student D)', count(*) = 1, format('count=%s', count(*))
  from public.results_audit where result_id = v_result_d and old_status = 'rejected' and new_status = 'draft';

  ----------------------------------------------------------------------
  -- Scenario 10: deleting the LAST remaining mark on a rejected result
  -- must be detected as a change, not silently ignored.
  ----------------------------------------------------------------------
  delete from public.marks where student_id = v_student_h;
  perform public.compute_results(v_term);

  select * into v_row from public.results where id = v_result_h;
  insert into test_log (scenario, passed, detail) values (
    'S10: deleting all marks on a rejected result is detected and returns it to draft',
    v_row.status = 'draft' and v_row.rejection_reason is null and v_row.total_obtained = 0 and v_row.total_max = 0,
    format('status=%s reason=%s total=%s/%s', v_row.status, v_row.rejection_reason, v_row.total_obtained, v_row.total_max)
  );

  ----------------------------------------------------------------------
  -- Scenario 11: deleting the last mark on a DRAFT result must zero its
  -- totals (not vanish from the loop, not go stale).
  ----------------------------------------------------------------------
  delete from public.marks where student_id = v_student_e;
  perform public.compute_results(v_term);

  select * into v_row from public.results where id = v_result_e;
  insert into test_log (scenario, passed, detail) values (
    'S11: deleting all marks on a draft result zeroes totals instead of going stale',
    v_row.status = 'draft' and v_row.total_obtained = 0 and v_row.total_max = 0 and v_row.overall_grade is null,
    format('status=%s total=%s/%s grade=%s', v_row.status, v_row.total_obtained, v_row.total_max, v_row.overall_grade)
  );

  ----------------------------------------------------------------------
  -- Scenario 12: non-principal roles remain denied
  ----------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_teacher_user::text, true);
  begin
    perform public.compute_results(v_term);
    insert into test_log (scenario, passed, detail) values
      ('S12: teacher is denied compute_results', false, 'no exception was raised');
  exception when others then
    insert into test_log (scenario, passed, detail) values
      ('S12: teacher is denied compute_results', sqlerrm ilike '%only the principal%', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', v_accountant_user::text, true);
  begin
    perform public.compute_results(v_term);
    insert into test_log (scenario, passed, detail) values
      ('S12b: accountant is denied compute_results', false, 'no exception was raised');
  exception when others then
    insert into test_log (scenario, passed, detail) values
      ('S12b: accountant is denied compute_results', sqlerrm ilike '%only the principal%', sqlerrm);
  end;
end;
$test$;

select seq, scenario, passed, detail from test_log order by seq;

-- Everything above — fixtures, auth.users rows, marks edits, status
-- transitions, audit rows — is discarded here. Follow with a separate,
-- fresh read-only connection afterward to confirm no TEST- prefixed rows
-- remain, per CLAUDE.md's verification convention.
rollback;
