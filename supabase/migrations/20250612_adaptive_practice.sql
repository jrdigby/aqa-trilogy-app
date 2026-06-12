-- Adaptive practice difficulty: profile state + per-spec-point offset
-- Run in Supabase SQL editor if migrations folder is not auto-applied.

alter table profiles
  add column if not exists adaptive_practice_state jsonb
  not null default '{"difficulty_offset":0,"boundary_streak":{"at_ft_ceiling":0,"at_ht_floor":0}}';

alter table srs_state
  add column if not exists practice_difficulty_offset smallint not null default 0;

comment on column profiles.adaptive_practice_state is
  'Global Exam Prep difficulty offset (-2..+2) and tier-boundary streak counters';

comment on column srs_state.practice_difficulty_offset is
  'Per-spec-point difficulty ramp (0..2) for Start Practice adaptive selection';

-- Optional: backfill difficulty from question_type heuristics when column exists but is unset
-- update questions set difficulty = 1 where difficulty is null or difficulty < 1;
