-- Update Cl₂ identify MCQ remedial feedback for the Cl distractor.

update answer_keys ak
set key_payload = jsonb_set(
  key_payload,
  '{option_feedback,Cl}',
  '"Chlorine atoms do not exist singly; this diagram shows a shared pair between two chlorine atoms."'::jsonb,
  true
)
from questions q
where q.id = ak.question_id
  and q.question_type = 'mcq'
  and ak.key_type = 'mcq'
  and ak.key_payload ->> 'correct' = 'Cl₂'
  and ak.key_payload -> 'option_feedback' ? 'Cl';
