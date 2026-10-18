-- profiles.id and auth.users.id are always equal (profiles is 1:1 with
-- auth.users via the handle_new_user trigger), but PostgREST can only embed
-- across an explicit FK it can see. Add one from user_roles to profiles so
-- `profiles.select("*, user_roles(role)")` works from the client.
alter table public.user_roles
  add constraint user_roles_profile_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
