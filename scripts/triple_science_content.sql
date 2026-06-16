-- Triple science content setup (run in Supabase SQL editor)
-- Prerequisites: combined spec_points already loaded.

-- 1. Drop legacy unique constraint (if not already applied via migration)
alter table spec_points drop constraint if exists spec_points_subject_spec_ref_key;

create unique index if not exists spec_points_track_subject_paper_ref_idx
  on spec_points (course_track, subject, paper, spec_ref);

-- 2. Clone combined spec_points → triple (placeholder refs/text; edit triple rows afterward)
insert into spec_points (course_track, subject, paper, topic_name, topic_number, spec_ref, spec_text)
select 'triple', subject, paper, topic_name, topic_number, spec_ref, spec_text
from spec_points
where course_track = 'combined'
  and subject in ('biology', 'chemistry', 'physics')
on conflict (course_track, subject, paper, spec_ref) do nothing;

-- 3. Auto-map equivalences (same subject, paper, spec_ref at clone time)
insert into spec_point_equivalences (combined_spec_point_id, triple_spec_point_id)
select c.id, t.id
from spec_points c
join spec_points t
  on t.course_track = 'triple'
 and t.subject = c.subject
 and t.paper = c.paper
 and t.spec_ref = c.spec_ref
where c.course_track = 'combined'
on conflict (combined_spec_point_id) do nothing;

-- 4. Link existing shared questions to triple spec points
update questions q
set triple_spec_point_id = e.triple_spec_point_id
from spec_point_equivalences e
where q.spec_point_id = e.combined_spec_point_id
  and q.audience = 'both'
  and q.triple_spec_point_id is null;

-- 5. Sanity checks
select count(*) as triple_spec_points from spec_points where course_track = 'triple';
select count(*) as equivalence_pairs from spec_point_equivalences;
select count(*) as unlinked_both_questions
from questions
where audience = 'both' and triple_spec_point_id is null;
