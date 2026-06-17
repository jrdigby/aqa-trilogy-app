-- AQA Triple GCSE Physics (8463) equation sheets — June 2026 curated per paper
-- Source: data/equation_sheets/triple_physics_*.json

insert into equation_sheets (id, subject, title, tier, paper, exam_series, course_track, equations) values
(
  'triple_physics_p1_ft',
  'physics',
  'AQA Triple Physics Paper 1 (Foundation)',
  'FT',
  'paper1',
  '2026',
  'triple',
  '[{"label":"Kinetic energy","latex":"E_k = \\frac{1}{2} m v^2","id":"kinetic_energy","topic_tags":["energy"]},{"label":"Elastic potential energy","latex":"E_e = \\frac{1}{2} k e^2","id":"elastic_potential_energy","topic_tags":["energy"]},{"label":"Gravitational potential energy","latex":"E_p = m g h","id":"gravitational_potential_energy","topic_tags":["energy"]},{"label":"Change in thermal energy","latex":"\\Delta E = m c \\Delta\\theta","id":"specific_heat_capacity","topic_tags":["particle_model"]},{"label":"Power (energy transferred)","latex":"P = \\frac{E}{t}","id":"power_energy","topic_tags":["energy"]},{"label":"Power (work done)","latex":"P = \\frac{W}{t}","id":"power_work","topic_tags":["energy"]},{"label":"Efficiency (energy)","latex":"\\text{efficiency} = \\frac{\\text{useful output energy transfer}}{\\text{total input energy transfer}}","id":"efficiency_energy","topic_tags":["energy"]},{"label":"Efficiency (power)","latex":"\\text{efficiency} = \\frac{\\text{useful power output}}{\\text{total power input}}","id":"efficiency_power","topic_tags":["energy"]},{"label":"Charge flow","latex":"Q = I t","id":"charge","topic_tags":["electricity"]},{"label":"Potential difference","latex":"V = I R","id":"potential_difference","topic_tags":["electricity"]},{"label":"Power (potential difference x current)","latex":"P = V I","id":"power_vi","topic_tags":["electricity"]},{"label":"Energy transferred (power x time)","latex":"E = P t","id":"energy_pt","topic_tags":["electricity"]},{"label":"Energy transferred (charge x p.d.)","latex":"E = Q V","id":"energy_qv","topic_tags":["electricity"]},{"label":"Density","latex":"\\rho = \\frac{m}{V}","id":"density","topic_tags":["particle_model"]},{"label":"Thermal energy for a change of state","latex":"E = m L","id":"specific_latent_heat","topic_tags":["particle_model"]}]'::jsonb
)
on conflict (id) do update set
  subject = excluded.subject,
  title = excluded.title,
  tier = excluded.tier,
  paper = excluded.paper,
  exam_series = excluded.exam_series,
  course_track = excluded.course_track,
  equations = excluded.equations;

insert into equation_sheets (id, subject, title, tier, paper, exam_series, course_track, equations) values
(
  'triple_physics_p1_ht',
  'physics',
  'AQA Triple Physics Paper 1 (Higher)',
  'HT',
  'paper1',
  '2026',
  'triple',
  '[{"label":"Kinetic energy","latex":"E_k = \\frac{1}{2} m v^2","id":"kinetic_energy","topic_tags":["energy"]},{"label":"Elastic potential energy","latex":"E_e = \\frac{1}{2} k e^2","id":"elastic_potential_energy","topic_tags":["energy"]},{"label":"Gravitational potential energy","latex":"E_p = m g h","id":"gravitational_potential_energy","topic_tags":["energy"]},{"label":"Change in thermal energy","latex":"\\Delta E = m c \\Delta\\theta","id":"specific_heat_capacity","topic_tags":["particle_model"]},{"label":"Power (energy transferred)","latex":"P = \\frac{E}{t}","id":"power_energy","topic_tags":["energy"]},{"label":"Power (work done)","latex":"P = \\frac{W}{t}","id":"power_work","topic_tags":["energy"]},{"label":"Efficiency (energy)","latex":"\\text{efficiency} = \\frac{\\text{useful output energy transfer}}{\\text{total input energy transfer}}","id":"efficiency_energy","topic_tags":["energy"]},{"label":"Efficiency (power)","latex":"\\text{efficiency} = \\frac{\\text{useful power output}}{\\text{total power input}}","id":"efficiency_power","topic_tags":["energy"]},{"label":"Charge flow","latex":"Q = I t","id":"charge","topic_tags":["electricity"]},{"label":"Potential difference","latex":"V = I R","id":"potential_difference","topic_tags":["electricity"]},{"label":"Power (potential difference x current)","latex":"P = V I","id":"power_vi","topic_tags":["electricity"]},{"label":"Power (current squared x resistance)","latex":"P = I^2 R","id":"power_i2r","topic_tags":["electricity"]},{"label":"Energy transferred (power x time)","latex":"E = P t","id":"energy_pt","topic_tags":["electricity"]},{"label":"Energy transferred (charge x p.d.)","latex":"E = Q V","id":"energy_qv","topic_tags":["electricity"]},{"label":"Density","latex":"\\rho = \\frac{m}{V}","id":"density","topic_tags":["particle_model"]},{"label":"Thermal energy for a change of state","latex":"E = m L","id":"specific_latent_heat","topic_tags":["particle_model"]}]'::jsonb
)
on conflict (id) do update set
  subject = excluded.subject,
  title = excluded.title,
  tier = excluded.tier,
  paper = excluded.paper,
  exam_series = excluded.exam_series,
  course_track = excluded.course_track,
  equations = excluded.equations;

insert into equation_sheets (id, subject, title, tier, paper, exam_series, course_track, equations) values
(
  'triple_physics_p2_ft',
  'physics',
  'AQA Triple Physics Paper 2 (Foundation)',
  'FT',
  'paper2',
  '2026',
  'triple',
  '[{"label":"Weight","latex":"W = m g","id":"weight","topic_tags":["forces"]},{"label":"Work done","latex":"W = F s","id":"work_done","topic_tags":["forces"]},{"label":"Force on a spring","latex":"F = k e","id":"spring_force","topic_tags":["forces"]},{"label":"Moment of a force","latex":"M = F d","id":"moment","topic_tags":["forces"]},{"label":"Pressure","latex":"p = \\frac{F}{A}","id":"pressure","topic_tags":["forces"]},{"label":"Distance travelled","latex":"s = v t","id":"distance_speed","topic_tags":["forces"]},{"label":"Acceleration","latex":"a = \\frac{\\Delta v}{t}","id":"acceleration","topic_tags":["forces"]},{"label":"Resultant force","latex":"F = m a","id":"force","topic_tags":["forces"]},{"label":"Period","latex":"T = \\frac{1}{f}","id":"period","topic_tags":["waves"]},{"label":"Wave speed","latex":"v = f \\lambda","id":"wave_speed","topic_tags":["waves"]},{"label":"Magnification","latex":"\\text{magnification} = \\frac{\\text{image height}}{\\text{object height}}","id":"magnification","topic_tags":["waves"]}]'::jsonb
)
on conflict (id) do update set
  subject = excluded.subject,
  title = excluded.title,
  tier = excluded.tier,
  paper = excluded.paper,
  exam_series = excluded.exam_series,
  course_track = excluded.course_track,
  equations = excluded.equations;

insert into equation_sheets (id, subject, title, tier, paper, exam_series, course_track, equations) values
(
  'triple_physics_p2_ht',
  'physics',
  'AQA Triple Physics Paper 2 (Higher)',
  'HT',
  'paper2',
  '2026',
  'triple',
  '[{"label":"Weight","latex":"W = m g","id":"weight","topic_tags":["forces"]},{"label":"Work done","latex":"W = F s","id":"work_done","topic_tags":["forces"]},{"label":"Force on a spring","latex":"F = k e","id":"spring_force","topic_tags":["forces"]},{"label":"Moment of a force","latex":"M = F d","id":"moment","topic_tags":["forces"]},{"label":"Pressure","latex":"p = \\frac{F}{A}","id":"pressure","topic_tags":["forces"]},{"label":"Pressure due to a column of liquid","latex":"p = h \\rho g","id":"pressure_column","topic_tags":["forces"]},{"label":"Distance travelled","latex":"s = v t","id":"distance_speed","topic_tags":["forces"]},{"label":"Acceleration","latex":"a = \\frac{\\Delta v}{t}","id":"acceleration","topic_tags":["forces"]},{"label":"Equations of motion","latex":"v^2 - u^2 = 2 a s","id":"suvat","topic_tags":["forces"]},{"label":"Force (change in momentum)","latex":"F = \\frac{m \\Delta v}{\\Delta t}","id":"force_momentum","topic_tags":["forces"]},{"label":"Resultant force","latex":"F = m a","id":"force","topic_tags":["forces"]},{"label":"Momentum","latex":"p = m v","id":"momentum","topic_tags":["forces"]},{"label":"Period","latex":"T = \\frac{1}{f}","id":"period","topic_tags":["waves"]},{"label":"Wave speed","latex":"v = f \\lambda","id":"wave_speed","topic_tags":["waves"]},{"label":"Magnification","latex":"\\text{magnification} = \\frac{\\text{image height}}{\\text{object height}}","id":"magnification","topic_tags":["waves"]},{"label":"Force on a conductor in a magnetic field","latex":"F = B I l","id":"force_on_conductor","topic_tags":["magnetism"]},{"label":"Transformer (power)","latex":"V_p I_p = V_s I_s","id":"transformer","topic_tags":["magnetism"]},{"label":"Transformer (turns ratio)","latex":"\\frac{V_p}{V_s} = \\frac{n_p}{n_s}","id":"transformer_turns","topic_tags":["magnetism"]},{"label":"Pressure x volume (gases)","latex":"p V = \\text{constant}","id":"pv_constant","topic_tags":["particle_model"]}]'::jsonb
)
on conflict (id) do update set
  subject = excluded.subject,
  title = excluded.title,
  tier = excluded.tier,
  paper = excluded.paper,
  exam_series = excluded.exam_series,
  course_track = excluded.course_track,
  equations = excluded.equations;
