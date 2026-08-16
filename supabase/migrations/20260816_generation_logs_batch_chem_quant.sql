-- Allow chemistry quantitative batch provenance on generation_logs.source

alter table public.generation_logs drop constraint if exists generation_logs_source_check;

alter table public.generation_logs
  add constraint generation_logs_source_check
  check (source in (
    'ai_studio',
    'ai_studio_import',
    'batch_numeric',
    'batch_chem_quant',
    'manual_create',
    'csv_import'
  ));

comment on table public.generation_logs is
  'Provenance for questions committed from AI Studio, JSON import, numeric/chem quantitative batch, manual create, or CSV import.';
