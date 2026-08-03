begin;

create or replace function public.owns_student_profile(target_profile_id text)
returns boolean
language sql
stable
security definer
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

revoke all on function public.owns_student_profile(text) from public;
grant execute on function public.owns_student_profile(text) to authenticated;

revoke all on table public.student_profiles from anon, authenticated;
revoke all on table public.study_units from anon, authenticated;
revoke all on table public.study_sessions from anon, authenticated;
revoke all on table public.question_attempts from anon, authenticated;
revoke all on table public.error_items from anon, authenticated;
revoke all on table public.review_items from anon, authenticated;
revoke all on table public.exam_attempts from anon, authenticated;
revoke all on table public.simulation_attempts from anon, authenticated;
revoke all on table public.taf_attempts from anon, authenticated;
revoke all on table public.devices from anon, authenticated;
revoke all on table public.student_settings from anon, authenticated;

grant select on table public.student_profiles to authenticated;
grant select, insert, update, delete on table public.study_units to authenticated;
grant select, insert, update on table public.study_sessions to authenticated;
grant select, insert on table public.question_attempts to authenticated;
grant select, insert, update, delete on table public.error_items to authenticated;
grant select, insert, update, delete on table public.review_items to authenticated;
grant select, insert, update on table public.exam_attempts to authenticated;
grant select, insert, update on table public.simulation_attempts to authenticated;
grant select, insert on table public.taf_attempts to authenticated;
grant select, insert, update, delete on table public.devices to authenticated;
grant select, insert, update on table public.student_settings to authenticated;

drop policy if exists student_profiles_select_own on public.student_profiles;
create policy student_profiles_select_own
on public.student_profiles
for select
to authenticated
using (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and is_active = true
);

commit;
