-- GCSE current / target grades collected at onboarding (and editable in Settings).
-- Shape:
--   combined: { "combined": "5/4" }
--   triple:   { "biology": 5, "chemistry": 4, "physics": 6 }

alter table profiles
  add column if not exists current_grades jsonb;

alter table profiles
  add column if not exists target_grades jsonb;
