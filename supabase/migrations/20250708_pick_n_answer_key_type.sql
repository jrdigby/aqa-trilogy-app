-- Allow "pick_n" pool marking as an answer_keys.key_type.
-- Used for "state/name/give N …" short-answer questions where the student earns
-- one mark per distinct acceptable answer (capped at max_marks), stored in
-- key_payload as { pool: [...], marks_per_hit: 1, distinct: true }.

alter table answer_keys drop constraint if exists answer_keys_key_type_check;

alter table answer_keys add constraint answer_keys_key_type_check
  check (key_type = any (array['mcq'::text, 'numeric'::text, 'keywords'::text, 'ai_rubric'::text, 'pick_n'::text]));
