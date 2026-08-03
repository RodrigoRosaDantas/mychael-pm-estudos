begin;

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.owns_student_profile(target_profile_id text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.student_profiles profile
      where profile.id = target_profile_id
        and profile.user_id = (select auth.uid())
        and profile.is_active = true
    );
$$;

revoke all on function private.owns_student_profile(text) from public, anon;
grant execute on function private.owns_student_profile(text) to authenticated;

alter policy study_units_select_own on public.study_units
using (private.owns_student_profile(profile_id));
alter policy study_units_insert_own on public.study_units
with check (private.owns_student_profile(profile_id));
alter policy study_units_update_own on public.study_units
using (private.owns_student_profile(profile_id))
with check (private.owns_student_profile(profile_id));
alter policy study_units_delete_own on public.study_units
using (private.owns_student_profile(profile_id));

alter policy study_sessions_select_own on public.study_sessions
using (private.owns_student_profile(profile_id));
alter policy study_sessions_insert_own on public.study_sessions
with check (private.owns_student_profile(profile_id));
alter policy study_sessions_update_own on public.study_sessions
using (private.owns_student_profile(profile_id))
with check (private.owns_student_profile(profile_id));

alter policy question_attempts_select_own on public.question_attempts
using (private.owns_student_profile(profile_id));
alter policy question_attempts_insert_own on public.question_attempts
with check (private.owns_student_profile(profile_id));

alter policy error_items_select_own on public.error_items
using (private.owns_student_profile(profile_id));
alter policy error_items_insert_own on public.error_items
with check (private.owns_student_profile(profile_id));
alter policy error_items_update_own on public.error_items
using (private.owns_student_profile(profile_id))
with check (private.owns_student_profile(profile_id));
alter policy error_items_delete_own on public.error_items
using (private.owns_student_profile(profile_id));

alter policy review_items_select_own on public.review_items
using (private.owns_student_profile(profile_id));
alter policy review_items_insert_own on public.review_items
with check (private.owns_student_profile(profile_id));
alter policy review_items_update_own on public.review_items
using (private.owns_student_profile(profile_id))
with check (private.owns_student_profile(profile_id));
alter policy review_items_delete_own on public.review_items
using (private.owns_student_profile(profile_id));

alter policy exam_attempts_select_own on public.exam_attempts
using (private.owns_student_profile(profile_id));
alter policy exam_attempts_insert_own on public.exam_attempts
with check (private.owns_student_profile(profile_id));
alter policy exam_attempts_update_own on public.exam_attempts
using (private.owns_student_profile(profile_id))
with check (private.owns_student_profile(profile_id));

alter policy simulation_attempts_select_own on public.simulation_attempts
using (private.owns_student_profile(profile_id));
alter policy simulation_attempts_insert_own on public.simulation_attempts
with check (private.owns_student_profile(profile_id));
alter policy simulation_attempts_update_own on public.simulation_attempts
using (private.owns_student_profile(profile_id))
with check (private.owns_student_profile(profile_id));

alter policy taf_attempts_select_own on public.taf_attempts
using (private.owns_student_profile(profile_id));
alter policy taf_attempts_insert_own on public.taf_attempts
with check (private.owns_student_profile(profile_id));

alter policy devices_select_own on public.devices
using (private.owns_student_profile(profile_id));
alter policy devices_insert_own on public.devices
with check (private.owns_student_profile(profile_id));
alter policy devices_update_own on public.devices
using (private.owns_student_profile(profile_id))
with check (private.owns_student_profile(profile_id));
alter policy devices_delete_own on public.devices
using (private.owns_student_profile(profile_id));

alter policy student_settings_select_own on public.student_settings
using (private.owns_student_profile(profile_id));
alter policy student_settings_insert_own on public.student_settings
with check (private.owns_student_profile(profile_id));
alter policy student_settings_update_own on public.student_settings
using (private.owns_student_profile(profile_id))
with check (private.owns_student_profile(profile_id));

revoke all on function public.set_updated_at() from public, anon, authenticated;
drop function if exists public.owns_student_profile(text);

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

commit;
