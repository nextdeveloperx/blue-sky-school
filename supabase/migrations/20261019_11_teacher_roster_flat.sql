-- PostgREST can't reliably embed joins through a view (no FK metadata to
-- introspect), so bake the display names directly into the view instead of
-- relying on client-side embedding.
drop view public.teacher_roster;

create view public.teacher_roster
  with (security_invoker = true)
  as
  select
    tsa.teacher_staff_id,
    tsa.section_id,
    tsa.subject_id,
    s.id as student_id,
    s.full_name,
    s.admission_no,
    subj.name as subject_name,
    sec.name as section_name,
    cls.name as class_name
  from public.teacher_subject_assignments tsa
  join public.students s
    on s.current_section_id = tsa.section_id and s.status = 'active'
  join public.subjects subj on subj.id = tsa.subject_id
  join public.sections sec on sec.id = tsa.section_id
  join public.classes cls on cls.id = sec.class_id
  where tsa.effective_to is null;
