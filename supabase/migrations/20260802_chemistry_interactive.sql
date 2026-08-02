-- Chemistry interactive question type: structured SVG / equation widgets

alter table questions add column if not exists chemistry_config jsonb;

comment on column questions.chemistry_config is
  'Config for chemistry_interactive questions: kind (electron_shell, ionic_bonding, covalent_bonding, organic_structure, polymer_structure, balance_equation) plus template and mark rules.';

alter table answer_keys drop constraint if exists answer_keys_key_type_check;

alter table answer_keys add constraint answer_keys_key_type_check
  check (key_type = any (array[
    'mcq'::text,
    'numeric'::text,
    'keywords'::text,
    'ai_rubric'::text,
    'pick_n'::text,
    'chemistry'::text
  ]));

alter table questions drop constraint if exists questions_marking_method_check;

alter table questions add constraint questions_marking_method_check
  check (marking_method = any (array[
    'keyword'::text,
    'ai_rubric'::text,
    'numeric'::text,
    'chemistry'::text
  ]));

alter table questions drop constraint if exists questions_question_type_check;

alter table questions add constraint questions_question_type_check
  check (question_type = any (array[
    'mcq'::text,
    'numeric'::text,
    'short_text'::text,
    'extended_response'::text,
    'chemistry_interactive'::text
  ]));
