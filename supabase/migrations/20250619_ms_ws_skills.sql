-- Maths Skills (MS) and Working Scientifically (WS) framework tags

create table if not exists skill_framework_items (
  id uuid primary key default gen_random_uuid(),
  framework text not null check (framework in ('MS', 'WS')),
  code text not null,
  full_code text not null unique,
  category text not null,
  title text not null,
  description text,
  subjects text[],
  sort_order smallint not null default 0,
  unique (framework, code)
);

create index if not exists skill_framework_items_framework_idx
  on skill_framework_items (framework, sort_order);

create table if not exists question_skills (
  question_id uuid not null references questions(id) on delete cascade,
  skill_id uuid not null references skill_framework_items(id) on delete cascade,
  primary key (question_id, skill_id)
);

create index if not exists question_skills_skill_id_idx on question_skills (skill_id);
create index if not exists question_skills_question_id_idx on question_skills (question_id);

-- Seed MS catalog
insert into skill_framework_items (framework, code, full_code, category, title, subjects, sort_order) values
  ('MS', '1a', 'MS1a', 'Arithmetic and numerical computation', 'Recognise and use expressions in decimal form', null, 1),
  ('MS', '1b', 'MS1b', 'Arithmetic and numerical computation', 'Recognise and use expressions in standard form', null, 2),
  ('MS', '1c', 'MS1c', 'Arithmetic and numerical computation', 'Use ratios, fractions and percentages', null, 3),
  ('MS', '1d', 'MS1d', 'Arithmetic and numerical computation', 'Make estimates of the results of simple calculations', null, 4),
  ('MS', '2a', 'MS2a', 'Handling data', 'Use an appropriate number of significant figures', null, 5),
  ('MS', '2b', 'MS2b', 'Handling data', 'Find arithmetic means', null, 6),
  ('MS', '2c', 'MS2c', 'Handling data', 'Construct and interpret frequency tables, bar charts and histograms', null, 7),
  ('MS', '2d', 'MS2d', 'Handling data', 'Understand the principles of sampling (biology only)', array['biology'], 8),
  ('MS', '2e', 'MS2e', 'Handling data', 'Understand simple probability (biology only)', array['biology'], 9),
  ('MS', '2f', 'MS2f', 'Handling data', 'Understand the terms mean, mode and median', null, 10),
  ('MS', '2g', 'MS2g', 'Handling data', 'Use a scatter diagram to identify correlation (biology and physics only)', array['biology', 'physics'], 11),
  ('MS', '2h', 'MS2h', 'Handling data', 'Make order of magnitude calculations', null, 12),
  ('MS', '3a', 'MS3a', 'Algebra', 'Understand and use symbols (=, <, <<, >>, >, ∝, ~)', null, 13),
  ('MS', '3b', 'MS3b', 'Algebra', 'Change the subject of an equation', null, 14),
  ('MS', '3c', 'MS3c', 'Algebra', 'Substitute numerical values into algebraic equations (chemistry and physics only)', array['chemistry', 'physics'], 15),
  ('MS', '3d', 'MS3d', 'Algebra', 'Solve simple algebraic equations (biology and physics only)', array['biology', 'physics'], 16),
  ('MS', '4a', 'MS4a', 'Graphs', 'Translate information between graphical and numeric form', null, 17),
  ('MS', '4b', 'MS4b', 'Graphs', 'Understand that y = mx + c represents a linear relationship', null, 18),
  ('MS', '4c', 'MS4c', 'Graphs', 'Plot two variables from experimental or other data', null, 19),
  ('MS', '4d', 'MS4d', 'Graphs', 'Determine the slope and intercept of a linear graph', null, 20),
  ('MS', '4e', 'MS4e', 'Graphs', 'Draw and use the slope of a tangent as rate of change (chemistry and physics only)', array['chemistry', 'physics'], 21),
  ('MS', '4f', 'MS4f', 'Graphs', 'Understand area under a curve (physics only)', array['physics'], 22),
  ('MS', '5a', 'MS5a', 'Geometry and trigonometry', 'Use angular measures in degrees (physics only)', array['physics'], 23),
  ('MS', '5b', 'MS5b', 'Geometry and trigonometry', 'Visualise and represent 2D and 3D forms (chemistry and physics only)', array['chemistry', 'physics'], 24),
  ('MS', '5c', 'MS5c', 'Geometry and trigonometry', 'Calculate areas, surface areas and volumes', null, 25)
on conflict (full_code) do nothing;

-- Seed WS catalog
insert into skill_framework_items (framework, code, full_code, category, title, subjects, sort_order) values
  ('WS', '1.1', 'WS1.1', 'Development of scientific thinking', 'Understand how scientific methods and theories develop over time', null, 101),
  ('WS', '1.2', 'WS1.2', 'Development of scientific thinking', 'Use a variety of models to solve problems and develop explanations', null, 102),
  ('WS', '1.3', 'WS1.3', 'Development of scientific thinking', 'Appreciate the power and limitations of science; ethical issues', null, 103),
  ('WS', '1.4', 'WS1.4', 'Development of scientific thinking', 'Explain applications of science; evaluate personal, social, economic and environmental implications', null, 104),
  ('WS', '1.5', 'WS1.5', 'Development of scientific thinking', 'Evaluate risks in practical science and wider societal context', null, 105),
  ('WS', '1.6', 'WS1.6', 'Development of scientific thinking', 'Recognise the importance of peer review and communicating results', null, 106),
  ('WS', '2.1', 'WS2.1', 'Experimental skills and strategies', 'Use scientific theories and explanations to develop hypotheses', null, 201),
  ('WS', '2.2', 'WS2.2', 'Experimental skills and strategies', 'Plan experiments or devise procedures to test hypotheses', null, 202),
  ('WS', '2.3', 'WS2.3', 'Experimental skills and strategies', 'Select appropriate techniques, instruments, apparatus and materials', null, 203),
  ('WS', '2.4', 'WS2.4', 'Experimental skills and strategies', 'Carry out experiments with correct manipulation, accuracy and H&S', null, 204),
  ('WS', '2.5', 'WS2.5', 'Experimental skills and strategies', 'Apply sampling techniques to ensure representative samples', null, 205),
  ('WS', '2.6', 'WS2.6', 'Experimental skills and strategies', 'Make and record observations and measurements', null, 206),
  ('WS', '2.7', 'WS2.7', 'Experimental skills and strategies', 'Evaluate methods and suggest possible improvements', null, 207),
  ('WS', '3.1', 'WS3.1', 'Analysis and evaluation', 'Present observations and data using appropriate methods', null, 301),
  ('WS', '3.2', 'WS3.2', 'Analysis and evaluation', 'Translate data from one form to another', null, 302),
  ('WS', '3.3', 'WS3.3', 'Analysis and evaluation', 'Carry out and represent mathematical and statistical analysis', null, 303),
  ('WS', '3.4', 'WS3.4', 'Analysis and evaluation', 'Represent distributions of results and estimations of uncertainty', null, 304),
  ('WS', '3.5', 'WS3.5', 'Analysis and evaluation', 'Interpret observations and data; identify patterns and trends', null, 305),
  ('WS', '3.6', 'WS3.6', 'Analysis and evaluation', 'Present reasoned explanations including relating data to hypotheses', null, 306),
  ('WS', '3.7', 'WS3.7', 'Analysis and evaluation', 'Evaluate data: accuracy, precision, repeatability, reproducibility, errors', null, 307),
  ('WS', '3.8', 'WS3.8', 'Analysis and evaluation', 'Communicate scientific rationale, methods, findings and conclusions', null, 308),
  ('WS', '4.1', 'WS4.1', 'Scientific vocabulary and units', 'Use scientific vocabulary, terminology and definitions', null, 401),
  ('WS', '4.2', 'WS4.2', 'Scientific vocabulary and units', 'Recognise the importance of scientific quantities', null, 402),
  ('WS', '4.3', 'WS4.3', 'Scientific vocabulary and units', 'Use SI units and IUPAC chemical nomenclature', null, 403),
  ('WS', '4.4', 'WS4.4', 'Scientific vocabulary and units', 'Use prefixes and powers of ten for orders of magnitude', null, 404),
  ('WS', '4.5', 'WS4.5', 'Scientific vocabulary and units', 'Interconvert units', null, 405),
  ('WS', '4.6', 'WS4.6', 'Scientific vocabulary and units', 'Use an appropriate number of significant figures in calculation', null, 406)
on conflict (full_code) do nothing;

-- RLS: read-only for authenticated users
alter table skill_framework_items enable row level security;

drop policy if exists skill_framework_items_read on skill_framework_items;
create policy skill_framework_items_read on skill_framework_items
  for select to authenticated using (true);

alter table question_skills enable row level security;

drop policy if exists question_skills_read on question_skills;
create policy question_skills_read on question_skills
  for select to authenticated using (true);

-- Developers can manage question_skills (admin writes via service role or developer policy)
drop policy if exists question_skills_developer_all on question_skills;
create policy question_skills_developer_all on question_skills
  for all to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.role = 'developer'
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.role = 'developer'
    )
  );
