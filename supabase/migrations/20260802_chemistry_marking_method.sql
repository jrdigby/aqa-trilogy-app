-- Allow chemistry_interactive questions to use marking_method = 'chemistry'

alter table questions drop constraint if exists questions_marking_method_check;

alter table questions add constraint questions_marking_method_check
  check (marking_method = any (array[
    'keyword'::text,
    'ai_rubric'::text,
    'numeric'::text,
    'chemistry'::text
  ]));
