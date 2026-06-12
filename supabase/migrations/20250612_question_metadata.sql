-- AQA exam metadata on questions (Phase 1 + Phase 4 admin authoring)

alter table questions add column if not exists command_word text;
alter table questions add column if not exists demand_level text;
alter table questions add column if not exists ao1_marks smallint;
alter table questions add column if not exists ao2_marks smallint;
alter table questions add column if not exists ao3_marks smallint;
alter table questions add column if not exists is_maths_skill boolean not null default false;
alter table questions add column if not exists is_required_practical boolean not null default false;

comment on column questions.command_word is 'AQA command word e.g. state, explain, calculate';
comment on column questions.demand_level is 'FT: low, standard. HT: standard_45, standard_67, high_89';
