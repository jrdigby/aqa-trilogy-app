-- Horizon-aware curriculum pacing fields on student profiles.
alter table public.profiles
  add column if not exists revision_horizon_preset text not null default 'y11';

alter table public.profiles
  add column if not exists target_exam_date date;

alter table public.profiles
  add column if not exists revision_pace_state jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_revision_horizon_preset_check;

alter table public.profiles
  add constraint profiles_revision_horizon_preset_check
  check (revision_horizon_preset in ('y10', 'y11', 'final_months'));

comment on column public.profiles.revision_horizon_preset is
  'y10 | y11 | final_months — drives default exam date when target_exam_date is null';
comment on column public.profiles.target_exam_date is
  'Optional override for first GCSE science paper date (typically ~11 May)';
comment on column public.profiles.revision_pace_state is
  'Tracks weekly/daily curriculum intro counts: { weekKey, today, introsThisWeek, introsToday }';
