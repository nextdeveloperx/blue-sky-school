-- track_student_section_change is a trigger function only; never callable
-- directly via PostgREST RPC. Same reasoning as handle_new_user.
revoke execute on function public.track_student_section_change() from public, anon, authenticated;
