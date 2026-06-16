-- Drop legacy unique constraint that ignored course_track (blocks combined + triple sharing spec_ref).
-- Correct uniqueness is (course_track, subject, paper, spec_ref) from 20250617 migration.

alter table spec_points drop constraint if exists spec_points_subject_spec_ref_key;

-- Ensure track-aware unique index exists (idempotent).
create unique index if not exists spec_points_track_subject_paper_ref_idx
  on spec_points (course_track, subject, paper, spec_ref);
