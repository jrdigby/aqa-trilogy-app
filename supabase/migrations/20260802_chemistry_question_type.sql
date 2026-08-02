-- Allow chemistry_interactive as a questions.question_type

alter table questions drop constraint if exists questions_question_type_check;

alter table questions add constraint questions_question_type_check
  check (question_type = any (array[
    'mcq'::text,
    'numeric'::text,
    'short_text'::text,
    'extended_response'::text,
    'chemistry_interactive'::text
  ]));
