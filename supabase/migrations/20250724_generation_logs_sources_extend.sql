-- Extend generation_logs.source for manual create + CSV import
-- (safe if 20250724_generation_logs already applied with the shorter list)

alter table public.generation_logs drop constraint if exists generation_logs_source_check;

alter table public.generation_logs
  add constraint generation_logs_source_check
  check (source in (
    'ai_studio',
    'ai_studio_import',
    'batch_numeric',
    'manual_create',
    'csv_import'
  ));

comment on table public.generation_logs is
  'Provenance for questions committed from AI Studio, JSON import, numeric batch, manual create, or CSV import.';
