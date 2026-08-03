-- Circuit + equipment interactive question types (SVG stem builders + structured answers)

alter table questions add column if not exists circuit_config jsonb;
alter table questions add column if not exists equipment_config jsonb;

comment on column questions.circuit_config is
  'Config for circuit_interactive: kind (identify_component, complete_slots, build_preset) plus template and answer.';

comment on column questions.equipment_config is
  'Config for equipment_interactive: kind (identify, label_hotspots) plus template and answer.';

alter table answer_keys drop constraint if exists answer_keys_key_type_check;

alter table answer_keys add constraint answer_keys_key_type_check
  check (key_type = any (array[
    'mcq'::text,
    'numeric'::text,
    'keywords'::text,
    'ai_rubric'::text,
    'pick_n'::text,
    'chemistry'::text,
    'circuit'::text,
    'equipment'::text
  ]));

alter table questions drop constraint if exists questions_marking_method_check;

alter table questions add constraint questions_marking_method_check
  check (marking_method = any (array[
    'keyword'::text,
    'ai_rubric'::text,
    'numeric'::text,
    'chemistry'::text,
    'circuit'::text,
    'equipment'::text
  ]));

alter table questions drop constraint if exists questions_question_type_check;

alter table questions add constraint questions_question_type_check
  check (question_type = any (array[
    'mcq'::text,
    'numeric'::text,
    'short_text'::text,
    'extended_response'::text,
    'chemistry_interactive'::text,
    'circuit_interactive'::text,
    'equipment_interactive'::text
  ]));
