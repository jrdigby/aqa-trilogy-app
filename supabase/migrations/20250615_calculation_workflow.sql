-- Physics calculation workflow: calculation_config on questions + shared equation sheets

alter table questions add column if not exists calculation_config jsonb;

comment on column questions.calculation_config is
  'Ordered calculation steps (equation select, substitution, conversion, rearrangement, calculate, sig figs)';

create table if not exists equation_sheets (
  id text primary key,
  subject text not null,
  title text not null,
  tier text,
  equations jsonb not null default '[]'::jsonb
);

comment on table equation_sheets is 'Reusable equation sheets for calculation questions (e.g. AQA Physics P2 HT)';

alter table equation_sheets enable row level security;

create policy "equation_sheets read for authenticated"
  on equation_sheets for select
  to authenticated
  using (true);

-- Seed AQA Trilogy Physics equation sheets (HT — includes additional equations)
insert into equation_sheets (id, subject, title, tier, equations) values
(
  'physics_p1_ft',
  'physics',
  'AQA Physics Paper 1 (Foundation)',
  'FT',
  '[
    {"id":"kinetic_energy","label":"Kinetic energy","latex":"E_k = \\frac{1}{2} m v^2","topic_tags":["energy"]},
    {"id":"gravitational_potential_energy","label":"Gravitational potential energy","latex":"E_p = m g h","topic_tags":["energy"]},
    {"id":"elastic_potential_energy","label":"Elastic potential energy","latex":"E_e = \\frac{1}{2} k e^2","topic_tags":["energy"]},
    {"id":"power","label":"Power","latex":"P = \\frac{E}{t}","topic_tags":["energy"]},
    {"id":"efficiency","label":"Efficiency","latex":"\\text{efficiency} = \\frac{\\text{useful output}}{\\text{total input}}","topic_tags":["energy"]},
    {"id":"charge","label":"Charge","latex":"Q = I t","topic_tags":["electricity"]},
    {"id":"potential_difference","label":"Potential difference","latex":"V = I R","topic_tags":["electricity"]},
    {"id":"power_iv","label":"Power (electrical)","latex":"P = I V","topic_tags":["electricity"]},
    {"id":"energy_transfer","label":"Energy transferred","latex":"E = P t","topic_tags":["electricity"]},
    {"id":"density","label":"Density","latex":"\\rho = \\frac{m}{V}","topic_tags":["particle_model"]},
    {"id":"specific_heat_capacity","label":"Specific heat capacity","latex":"\\Delta E = m c \\Delta\\theta","topic_tags":["particle_model"]},
    {"id":"force","label":"Force","latex":"F = m a","topic_tags":["forces"]},
    {"id":"weight","label":"Weight","latex":"W = m g","topic_tags":["forces"]},
    {"id":"work_done","label":"Work done","latex":"W = F s","topic_tags":["forces"]},
    {"id":"moment","label":"Moment","latex":"M = F d","topic_tags":["forces"]},
    {"id":"pressure","label":"Pressure","latex":"p = \\frac{F}{A}","topic_tags":["forces"]},
    {"id":"speed","label":"Speed","latex":"v = \\frac{s}{t}","topic_tags":["forces"]},
    {"id":"acceleration","label":"Acceleration","latex":"a = \\frac{\\Delta v}{t}","topic_tags":["forces"]},
    {"id":"wave_speed","label":"Wave speed","latex":"v = f \\lambda","topic_tags":["waves"]},
    {"id":"frequency","label":"Frequency","latex":"f = \\frac{1}{T}","topic_tags":["waves"]}
  ]'::jsonb
),
(
  'physics_p2_ft',
  'physics',
  'AQA Physics Paper 2 (Foundation)',
  'FT',
  '[
    {"id":"kinetic_energy","label":"Kinetic energy","latex":"E_k = \\frac{1}{2} m v^2","topic_tags":["energy"]},
    {"id":"gravitational_potential_energy","label":"Gravitational potential energy","latex":"E_p = m g h","topic_tags":["energy"]},
    {"id":"power","label":"Power","latex":"P = \\frac{E}{t}","topic_tags":["energy"]},
    {"id":"force","label":"Force","latex":"F = m a","topic_tags":["forces"]},
    {"id":"weight","label":"Weight","latex":"W = m g","topic_tags":["forces"]},
    {"id":"work_done","label":"Work done","latex":"W = F s","topic_tags":["forces"]},
    {"id":"speed","label":"Speed","latex":"v = \\frac{s}{t}","topic_tags":["forces"]},
    {"id":"acceleration","label":"Acceleration","latex":"a = \\frac{\\Delta v}{t}","topic_tags":["forces"]},
    {"id":"momentum","label":"Momentum","latex":"p = m v","topic_tags":["forces"]},
    {"id":"wave_speed","label":"Wave speed","latex":"v = f \\lambda","topic_tags":["waves"]},
    {"id":"frequency","label":"Frequency","latex":"f = \\frac{1}{T}","topic_tags":["waves"]},
    {"id":"potential_difference","label":"Potential difference","latex":"V = I R","topic_tags":["electricity"]},
    {"id":"power_iv","label":"Power (electrical)","latex":"P = I V","topic_tags":["electricity"]},
    {"id":"density","label":"Density","latex":"\\rho = \\frac{m}{V}","topic_tags":["particle_model"]}
  ]'::jsonb
),
(
  'physics_p2_ht',
  'physics',
  'AQA Physics Paper 2 (Higher)',
  'HT',
  '[
    {"id":"kinetic_energy","label":"Kinetic energy","latex":"E_k = \\frac{1}{2} m v^2","topic_tags":["energy"]},
    {"id":"gravitational_potential_energy","label":"Gravitational potential energy","latex":"E_p = m g h","topic_tags":["energy"]},
    {"id":"elastic_potential_energy","label":"Elastic potential energy","latex":"E_e = \\frac{1}{2} k e^2","topic_tags":["energy"]},
    {"id":"power","label":"Power","latex":"P = \\frac{E}{t}","topic_tags":["energy"]},
    {"id":"efficiency","label":"Efficiency","latex":"\\text{efficiency} = \\frac{\\text{useful output}}{\\text{total input}}","topic_tags":["energy"]},
    {"id":"charge","label":"Charge","latex":"Q = I t","topic_tags":["electricity"]},
    {"id":"potential_difference","label":"Potential difference","latex":"V = I R","topic_tags":["electricity"]},
    {"id":"power_iv","label":"Power (electrical)","latex":"P = I V","topic_tags":["electricity"]},
    {"id":"energy_transfer","label":"Energy transferred","latex":"E = P t","topic_tags":["electricity"]},
    {"id":"force","label":"Force","latex":"F = m a","topic_tags":["forces"]},
    {"id":"weight","label":"Weight","latex":"W = m g","topic_tags":["forces"]},
    {"id":"work_done","label":"Work done","latex":"W = F s","topic_tags":["forces"]},
    {"id":"moment","label":"Moment","latex":"M = F d","topic_tags":["forces"]},
    {"id":"pressure","label":"Pressure","latex":"p = \\frac{F}{A}","topic_tags":["forces"]},
    {"id":"speed","label":"Speed","latex":"v = \\frac{s}{t}","topic_tags":["forces"]},
    {"id":"acceleration","label":"Acceleration","latex":"a = \\frac{\\Delta v}{t}","topic_tags":["forces"]},
    {"id":"momentum","label":"Momentum","latex":"p = m v","topic_tags":["forces"]},
    {"id":"force_momentum","label":"Force and momentum","latex":"F = \\frac{\\Delta p}{t}","topic_tags":["forces"]},
    {"id":"wave_speed","label":"Wave speed","latex":"v = f \\lambda","topic_tags":["waves"]},
    {"id":"frequency","label":"Frequency","latex":"f = \\frac{1}{T}","topic_tags":["waves"]},
    {"id":"density","label":"Density","latex":"\\rho = \\frac{m}{V}","topic_tags":["particle_model"]},
    {"id":"specific_heat_capacity","label":"Specific heat capacity","latex":"\\Delta E = m c \\Delta\\theta","topic_tags":["particle_model"]},
    {"id":"specific_latent_heat","label":"Specific latent heat","latex":"E = m L","topic_tags":["particle_model"]},
    {"id":"gas_pressure","label":"Gas pressure","latex":"p V = \\text{constant}","topic_tags":["particle_model"]}
  ]'::jsonb
)
on conflict (id) do update set
  subject = excluded.subject,
  title = excluded.title,
  tier = excluded.tier,
  equations = excluded.equations;
