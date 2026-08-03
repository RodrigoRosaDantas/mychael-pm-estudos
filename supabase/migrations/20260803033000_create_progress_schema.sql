begin;

create extension if not exists pgcrypto;

create table if not exists public.student_profiles (
  id text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_profiles_id_format check (id ~ '^STU-[A-Z0-9-]+$')
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.owns_student_profile(target_profile_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.student_profiles profile
      where profile.id = target_profile_id
        and profile.user_id = auth.uid()
        and profile.is_active = true
    );
$$;

revoke all on function public.owns_student_profile(text) from public;
grant execute on function public.owns_student_profile(text) to authenticated;

create table if not exists public.study_units (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.student_profiles(id) on delete cascade,
  unit_id text not null,
  status text not null default 'not_started',
  mastery_percent numeric(5,2),
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_units_unique unique (profile_id, unit_id),
  constraint study_units_status_check check (status in ('not_started', 'in_progress', 'completed', 'review_due')),
  constraint study_units_mastery_check check (mastery_percent is null or mastery_percent between 0 and 100)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.student_profiles(id) on delete cascade,
  activity_type text not null,
  activity_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_activity_check check (activity_type in ('unit', 'material', 'question_set', 'exam', 'simulation', 'taf', 'review')),
  constraint study_sessions_duration_check check (duration_ms is null or duration_ms >= 0),
  constraint study_sessions_dates_check check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.student_profiles(id) on delete cascade,
  question_id text not null,
  unit_id text,
  question_set_id text,
  answer text,
  is_correct boolean,
  duration_ms integer,
  attempt_number integer not null default 1,
  answered_at timestamptz not null default now(),
  client_event_id uuid unique,
  constraint question_attempts_duration_check check (duration_ms is null or duration_ms >= 0),
  constraint question_attempts_number_check check (attempt_number > 0)
);

create table if not exists public.error_items (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.student_profiles(id) on delete cascade,
  question_id text not null,
  attempt_id uuid references public.question_attempts(id) on delete set null,
  error_type text not null default 'content',
  notes text,
  status text not null default 'open',
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint error_items_type_check check (error_type in ('content', 'attention', 'interpretation', 'time', 'guess', 'blank', 'other')),
  constraint error_items_status_check check (status in ('open', 'reviewing', 'resolved'))
);

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.student_profiles(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  reason text,
  status text not null default 'scheduled',
  repetitions integer not null default 0,
  interval_days integer not null default 1,
  ease_factor numeric(4,2) not null default 2.50,
  last_reviewed_at timestamptz,
  next_review_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_items_unique unique (profile_id, source_type, source_id),
  constraint review_items_source_check check (source_type in ('unit', 'material', 'question', 'question_set', 'exam', 'simulation', 'taf')),
  constraint review_items_status_check check (status in ('scheduled', 'due', 'completed', 'paused')),
  constraint review_items_repetitions_check check (repetitions >= 0),
  constraint review_items_interval_check check (interval_days >= 0),
  constraint review_items_ease_check check (ease_factor >= 1.30)
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.student_profiles(id) on delete cascade,
  exam_id text not null,
  mode text not null default 'real_exam',
  status text not null default 'started',
  answers jsonb not null default '{}'::jsonb,
  score_percent numeric(5,2),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_attempts_mode_check check (mode in ('real_exam', 'study', 'retry_errors', 'by_subject')),
  constraint exam_attempts_status_check check (status in ('started', 'abandoned', 'completed')),
  constraint exam_attempts_score_check check (score_percent is null or score_percent between 0 and 100),
  constraint exam_attempts_duration_check check (duration_ms is null or duration_ms >= 0)
);

create table if not exists public.simulation_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.student_profiles(id) on delete cascade,
  simulation_id text not null,
  status text not null default 'started',
  answers jsonb not null default '{}'::jsonb,
  score_percent numeric(5,2),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulation_attempts_status_check check (status in ('started', 'abandoned', 'completed')),
  constraint simulation_attempts_score_check check (score_percent is null or score_percent between 0 and 100),
  constraint simulation_attempts_duration_check check (duration_ms is null or duration_ms >= 0)
);

create table if not exists public.taf_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.student_profiles(id) on delete cascade,
  test_id text not null,
  reference_id text,
  performed_at timestamptz not null default now(),
  measured_value numeric,
  measured_unit text,
  medical_clearance boolean not null default false,
  professional_supervision boolean not null default false,
  notes text,
  client_event_id uuid unique,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.student_profiles(id) on delete cascade,
  device_key text not null,
  label text,
  last_seen_at timestamptz not null default now(),
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_unique unique (profile_id, device_key)
);

create table if not exists public.student_settings (
  profile_id text primary key references public.student_profiles(id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  daily_goal_minutes integer not null default 45,
  theme text not null default 'system',
  accessibility jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_settings_goal_check check (daily_goal_minutes between 5 and 600),
  constraint student_settings_theme_check check (theme in ('system', 'light', 'dark'))
);

create index if not exists study_units_profile_status_idx on public.study_units (profile_id, status);
create index if not exists study_sessions_profile_started_idx on public.study_sessions (profile_id, started_at desc);
create index if not exists question_attempts_profile_question_idx on public.question_attempts (profile_id, question_id, answered_at desc);
create index if not exists error_items_profile_status_idx on public.error_items (profile_id, status);
create index if not exists review_items_profile_due_idx on public.review_items (profile_id, next_review_at);
create index if not exists exam_attempts_profile_exam_idx on public.exam_attempts (profile_id, exam_id, started_at desc);
create index if not exists simulation_attempts_profile_idx on public.simulation_attempts (profile_id, started_at desc);
create index if not exists taf_attempts_profile_test_idx on public.taf_attempts (profile_id, test_id, performed_at desc);
create index if not exists devices_profile_seen_idx on public.devices (profile_id, last_seen_at desc);

create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function public.set_updated_at();

create trigger study_units_set_updated_at
before update on public.study_units
for each row execute function public.set_updated_at();

create trigger study_sessions_set_updated_at
before update on public.study_sessions
for each row execute function public.set_updated_at();

create trigger error_items_set_updated_at
before update on public.error_items
for each row execute function public.set_updated_at();

create trigger review_items_set_updated_at
before update on public.review_items
for each row execute function public.set_updated_at();

create trigger exam_attempts_set_updated_at
before update on public.exam_attempts
for each row execute function public.set_updated_at();

create trigger simulation_attempts_set_updated_at
before update on public.simulation_attempts
for each row execute function public.set_updated_at();

create trigger devices_set_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

create trigger student_settings_set_updated_at
before update on public.student_settings
for each row execute function public.set_updated_at();

alter table public.student_profiles enable row level security;
alter table public.study_units enable row level security;
alter table public.study_sessions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.error_items enable row level security;
alter table public.review_items enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.simulation_attempts enable row level security;
alter table public.taf_attempts enable row level security;
alter table public.devices enable row level security;
alter table public.student_settings enable row level security;

create policy student_profiles_select_own
on public.student_profiles
for select
to authenticated
using (user_id = auth.uid() and is_active = true);

create policy study_units_select_own
on public.study_units for select to authenticated
using (public.owns_student_profile(profile_id));
create policy study_units_insert_own
on public.study_units for insert to authenticated
with check (public.owns_student_profile(profile_id));
create policy study_units_update_own
on public.study_units for update to authenticated
using (public.owns_student_profile(profile_id))
with check (public.owns_student_profile(profile_id));
create policy study_units_delete_own
on public.study_units for delete to authenticated
using (public.owns_student_profile(profile_id));

create policy study_sessions_select_own
on public.study_sessions for select to authenticated
using (public.owns_student_profile(profile_id));
create policy study_sessions_insert_own
on public.study_sessions for insert to authenticated
with check (public.owns_student_profile(profile_id));
create policy study_sessions_update_own
on public.study_sessions for update to authenticated
using (public.owns_student_profile(profile_id))
with check (public.owns_student_profile(profile_id));

create policy question_attempts_select_own
on public.question_attempts for select to authenticated
using (public.owns_student_profile(profile_id));
create policy question_attempts_insert_own
on public.question_attempts for insert to authenticated
with check (public.owns_student_profile(profile_id));

create policy error_items_select_own
on public.error_items for select to authenticated
using (public.owns_student_profile(profile_id));
create policy error_items_insert_own
on public.error_items for insert to authenticated
with check (public.owns_student_profile(profile_id));
create policy error_items_update_own
on public.error_items for update to authenticated
using (public.owns_student_profile(profile_id))
with check (public.owns_student_profile(profile_id));
create policy error_items_delete_own
on public.error_items for delete to authenticated
using (public.owns_student_profile(profile_id));

create policy review_items_select_own
on public.review_items for select to authenticated
using (public.owns_student_profile(profile_id));
create policy review_items_insert_own
on public.review_items for insert to authenticated
with check (public.owns_student_profile(profile_id));
create policy review_items_update_own
on public.review_items for update to authenticated
using (public.owns_student_profile(profile_id))
with check (public.owns_student_profile(profile_id));
create policy review_items_delete_own
on public.review_items for delete to authenticated
using (public.owns_student_profile(profile_id));

create policy exam_attempts_select_own
on public.exam_attempts for select to authenticated
using (public.owns_student_profile(profile_id));
create policy exam_attempts_insert_own
on public.exam_attempts for insert to authenticated
with check (public.owns_student_profile(profile_id));
create policy exam_attempts_update_own
on public.exam_attempts for update to authenticated
using (public.owns_student_profile(profile_id))
with check (public.owns_student_profile(profile_id));

create policy simulation_attempts_select_own
on public.simulation_attempts for select to authenticated
using (public.owns_student_profile(profile_id));
create policy simulation_attempts_insert_own
on public.simulation_attempts for insert to authenticated
with check (public.owns_student_profile(profile_id));
create policy simulation_attempts_update_own
on public.simulation_attempts for update to authenticated
using (public.owns_student_profile(profile_id))
with check (public.owns_student_profile(profile_id));

create policy taf_attempts_select_own
on public.taf_attempts for select to authenticated
using (public.owns_student_profile(profile_id));
create policy taf_attempts_insert_own
on public.taf_attempts for insert to authenticated
with check (public.owns_student_profile(profile_id));

create policy devices_select_own
on public.devices for select to authenticated
using (public.owns_student_profile(profile_id));
create policy devices_insert_own
on public.devices for insert to authenticated
with check (public.owns_student_profile(profile_id));
create policy devices_update_own
on public.devices for update to authenticated
using (public.owns_student_profile(profile_id))
with check (public.owns_student_profile(profile_id));
create policy devices_delete_own
on public.devices for delete to authenticated
using (public.owns_student_profile(profile_id));

create policy student_settings_select_own
on public.student_settings for select to authenticated
using (public.owns_student_profile(profile_id));
create policy student_settings_insert_own
on public.student_settings for insert to authenticated
with check (public.owns_student_profile(profile_id));
create policy student_settings_update_own
on public.student_settings for update to authenticated
using (public.owns_student_profile(profile_id))
with check (public.owns_student_profile(profile_id));

commit;
