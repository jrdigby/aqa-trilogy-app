/**
 * Interactive science journey locations.
 * mapX/mapY are calibrated to images/world-map.svg (viewBox 0 0 950 620).
 * Scientists aim for gender balance and global representation, including Africa.
 */

export const EARTH_RADIUS_KM = 6371;
export const HALF_WORLD_KM = 20000;
export const FULL_WORLD_KM = 40000;
export const START_LOCATION_ID = "london";

/** Fitted to images/world-map.svg control points (not pure equirectangular). */
export const MAP_PROJ_X = { a: 2.6945, b: 452.51 };
export const MAP_PROJ_Y = { a: -3.2931, b: 330.97 };

export function projectLatLng(lat, lng) {
  return {
    x: MAP_PROJ_X.a * lng + MAP_PROJ_X.b,
    y: MAP_PROJ_Y.a * lat + MAP_PROJ_Y.b
  };
}

/** Wikimedia Commons portrait (width-scaled). Returns null when no free portrait is available. */
export function commonsScientistPhoto(filename, width = 200) {
  if (!filename) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;
}

/** @typedef {{ id: string, name: string, country: string, countryKey: string, lat: number, lng: number, mapX: number, mapY: number, scientist: object }} JourneyLocation */

export const JOURNEY_LOCATIONS = [
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    countryKey: "UK",
    lat: 51.5074,
    lng: -0.1278,
    mapX: 452,
    mapY: 161,
    scientist: {
      id: "rosalind_franklin",
      name: "Rosalind Franklin",
      gender: "F",
      subjects: ["biology", "chemistry"],
      era: "1920–1958",
      fact: "Her X-ray diffraction images were crucial to understanding DNA's double helix.",
      gcseLink: "DNA structure — genetics and inheritance.",
      photo: commonsScientistPhoto("Rosalind_Franklin_(retouched).jpg")
    }
  },
  {
    id: "paris",
    name: "Paris",
    country: "France",
    countryKey: "France",
    lat: 48.8566,
    lng: 2.3522,
    mapX: 459,
    mapY: 170,
    scientist: {
      id: "marie_curie",
      name: "Marie Curie",
      gender: "F",
      subjects: ["physics", "chemistry"],
      era: "1867–1934",
      fact: "First person to win Nobel Prizes in two different sciences.",
      gcseLink: "Radioactivity — atomic structure and ionising radiation.",
      photo: commonsScientistPhoto("Marie_Curie_c._1920s.jpg")
    }
  },
  {
    id: "berlin",
    name: "Berlin",
    country: "Germany",
    countryKey: "Germany",
    lat: 52.52,
    lng: 13.405,
    mapX: 489,
    mapY: 158,
    scientist: {
      id: "lise_meitner",
      name: "Lise Meitner",
      gender: "F",
      subjects: ["physics"],
      era: "1878–1968",
      fact: "Explained nuclear fission — how a heavy nucleus can split and release energy.",
      gcseLink: "Nuclear fission, chain reactions, and radioactive decay.",
      photo: commonsScientistPhoto("Lise_Meitner_NatGeo.jpg")
    }
  },
  {
    id: "rome",
    name: "Rome",
    country: "Italy",
    countryKey: "Italy",
    lat: 41.9028,
    lng: 12.4964,
    mapX: 486,
    mapY: 193,
    scientist: {
      id: "laura_bassi",
      name: "Laura Bassi",
      gender: "F",
      subjects: ["physics"],
      era: "1711–1778",
      fact: "One of the first women to hold a university chair in physics in Europe.",
      gcseLink: "Forces, electricity, and early experimental science.",
      photo: commonsScientistPhoto("Carlo_Vandi_-_Ritratto_di_Laura_Bassi_-_Museo_Europeo_degli_Studenti.png")
    }
  },
  {
    id: "stockholm",
    name: "Stockholm",
    country: "Sweden",
    countryKey: "Sweden",
    lat: 59.3293,
    lng: 18.0686,
    mapX: 501,
    mapY: 136,
    scientist: {
      id: "svante_arrhenius",
      name: "Svante Arrhenius",
      gender: "M",
      subjects: ["chemistry"],
      era: "1859–1927",
      fact: "Explained how acids and bases form ions in water — and linked CO₂ to Earth's climate.",
      gcseLink: "Acids, bases, ions, and rates of reaction.",
      photo: commonsScientistPhoto("Arrhenius2.jpg")
    }
  },
  {
    id: "cairo",
    name: "Cairo",
    country: "Egypt",
    countryKey: "Egypt",
    lat: 30.0444,
    lng: 31.2357,
    mapX: 537,
    mapY: 245,
    scientist: {
      id: "ahmed_zewail",
      name: "Ahmed Zewail",
      gender: "M",
      subjects: ["chemistry", "physics"],
      era: "1946–2016",
      fact: "Pioneered femtochemistry — watching chemical bonds break and form in real time.",
      gcseLink: "Rates of reaction — collision theory and activation energy.",
      photo: commonsScientistPhoto("Ahmed_Zewail_HD2009_Othmer_Gold_Medal_portrait.JPG")
    }
  },
  {
    id: "accra",
    name: "Accra",
    country: "Ghana",
    countryKey: "Ghana",
    lat: 5.6037,
    lng: -0.187,
    mapX: 452,
    mapY: 318,
    scientist: {
      id: "francis_allotey",
      name: "Francis Allotey",
      gender: "M",
      subjects: ["physics"],
      era: "1932–2017",
      fact: "Developed the Allotey formalism for soft X-ray spectroscopy — and championed science education in Africa.",
      gcseLink: "Atomic structure, electrons, and electromagnetic radiation.",
      photo: null
    }
  },
  {
    id: "lagos",
    name: "Lagos",
    country: "Nigeria",
    countryKey: "Nigeria",
    lat: 6.5244,
    lng: 3.3792,
    mapX: 462,
    mapY: 320,
    scientist: {
      id: "francisca_okeke",
      name: "Francisca Okeke",
      gender: "F",
      subjects: ["physics"],
      era: "1956–",
      fact: "Researches Earth's ionosphere and how solar activity affects the atmosphere over Africa.",
      gcseLink: "Waves, radiation, and Earth's atmosphere.",
      photo: commonsScientistPhoto("Prof._Francisca_Okeke.jpg")
    }
  },
  {
    id: "nairobi",
    name: "Nairobi",
    country: "Kenya",
    countryKey: "Kenya",
    lat: -1.2921,
    lng: 36.8219,
    mapX: 555,
    mapY: 340,
    scientist: {
      id: "wangari_maathai",
      name: "Wangari Maathai",
      gender: "F",
      subjects: ["biology"],
      era: "1940–2011",
      fact: "Founded the Green Belt Movement and showed how ecosystems, communities, and climate are linked.",
      gcseLink: "Ecosystems, biodiversity, and human impact on the environment.",
      photo: commonsScientistPhoto("Wangari_Maathai.jpg")
    }
  },
  {
    id: "cape_town",
    name: "Cape Town",
    country: "South Africa",
    countryKey: "SouthAfrica",
    lat: -33.9249,
    lng: 18.4241,
    mapX: 528,
    mapY: 428,
    scientist: {
      id: "aaron_klug",
      name: "Aaron Klug",
      gender: "M",
      subjects: ["biology", "chemistry"],
      era: "1926–2018",
      fact: "Used electron microscopy to reveal the structure of viruses and chromosomes.",
      gcseLink: "Cells, DNA, and microscopy as scientific evidence.",
      photo: commonsScientistPhoto("Aaron_Klug_1979.jpg")
    }
  },
  {
    id: "mumbai",
    name: "Mumbai",
    country: "India",
    countryKey: "India",
    lat: 19.076,
    lng: 72.8777,
    mapX: 655,
    mapY: 280,
    scientist: {
      id: "janaki_ammal",
      name: "Janaki Ammal",
      gender: "F",
      subjects: ["biology"],
      era: "1897–1984",
      fact: "Pioneering cytogeneticist who studied plant chromosomes and championed biodiversity in India.",
      gcseLink: "Cell division, chromosomes, and genetic variation.",
      photo: commonsScientistPhoto("E_K_Janaki_Ammal.jpg")
    }
  },
  {
    id: "delhi",
    name: "Delhi",
    country: "India",
    countryKey: "India",
    lat: 28.7041,
    lng: 77.1025,
    mapX: 668,
    mapY: 245,
    scientist: {
      id: "cv_raman",
      name: "C. V. Raman",
      gender: "M",
      subjects: ["physics"],
      era: "1888–1970",
      fact: "Discovered the Raman effect — how light changes wavelength when scattered by molecules.",
      gcseLink: "Waves — light, scattering, and the electromagnetic spectrum.",
      photo: commonsScientistPhoto("Sir_CV_Raman.JPG")
    }
  },
  {
    id: "beijing",
    name: "Beijing",
    country: "China",
    countryKey: "China",
    lat: 39.9042,
    lng: 116.4074,
    mapX: 760,
    mapY: 195,
    scientist: {
      id: "tu_youyou",
      name: "Tu Youyou",
      gender: "F",
      subjects: ["biology", "chemistry"],
      era: "1930–",
      fact: "Discovered artemisinin from traditional Chinese medicine — a breakthrough antimalarial drug.",
      gcseLink: "Drug discovery, testing medicines, and treating disease.",
      photo: commonsScientistPhoto("D810_4987_Tu_Youyou,_medicine_(22945001843)_(cropped).jpg")
    }
  },
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    countryKey: "Japan",
    lat: 35.6762,
    lng: 139.6503,
    mapX: 825,
    mapY: 210,
    scientist: {
      id: "katsuko_saruhashi",
      name: "Katsuko Saruhashi",
      gender: "F",
      subjects: ["chemistry"],
      era: "1920–2007",
      fact: "Measured CO₂ in seawater and tracked radioactive fallout across the Pacific.",
      gcseLink: "Earth's atmosphere, oceans, and human impact on climate.",
      photo: null
    }
  },
  {
    id: "sydney",
    name: "Sydney",
    country: "Australia",
    countryKey: "Australia",
    lat: -33.8688,
    lng: 151.2093,
    mapX: 862,
    mapY: 445,
    scientist: {
      id: "dorothy_hill",
      name: "Dorothy Hill",
      gender: "F",
      subjects: ["biology"],
      era: "1907–1997",
      fact: "Australia's first female professor of geology — mapped ancient coral reefs and Earth's history.",
      gcseLink: "Rock cycle, fossils, and evidence for Earth's past environments.",
      photo: commonsScientistPhoto("Portrait_of_Dorothy_Hill_in_academic_robes.jpg")
    }
  },
  {
    id: "auckland",
    name: "Auckland",
    country: "New Zealand",
    countryKey: "NewZealand",
    lat: -36.8509,
    lng: 174.7645,
    mapX: 915,
    mapY: 492,
    scientist: {
      id: "beatrice_tinsley",
      name: "Beatrice Tinsley",
      gender: "F",
      subjects: ["physics"],
      era: "1941–1981",
      fact: "Showed how galaxies evolve over time — transforming modern cosmology.",
      gcseLink: "The expanding universe, stars, and life cycles of galaxies.",
      photo: null
    }
  },
  {
    id: "los_angeles",
    name: "Los Angeles",
    country: "United States",
    countryKey: "USA",
    lat: 34.0522,
    lng: -118.2437,
    mapX: 138,
    mapY: 225,
    scientist: {
      id: "chien_shiung_wu",
      name: "Chien-Shiung Wu",
      gender: "F",
      subjects: ["physics"],
      era: "1912–1997",
      fact: "Proved that nature can prefer a 'handedness' in weak nuclear interactions — the Wu experiment.",
      gcseLink: "Radioactivity, nuclear physics, and experimental evidence.",
      photo: commonsScientistPhoto("Chien-shiung_Wu_(1912-1997)_C.jpg")
    }
  },
  {
    id: "new_york",
    name: "New York",
    country: "United States",
    countryKey: "USA",
    lat: 40.7128,
    lng: -74.006,
    mapX: 262,
    mapY: 185,
    scientist: {
      id: "barbara_mcclintock",
      name: "Barbara McClintock",
      gender: "F",
      subjects: ["biology"],
      era: "1902–1992",
      fact: "Discovered that genes can move on chromosomes — 'jumping genes'.",
      gcseLink: "Inheritance — genes, chromosomes, and genetic variation.",
      photo: commonsScientistPhoto("Barbara_McClintock_(1902-1992).jpg")
    }
  },
  {
    id: "mexico_city",
    name: "Mexico City",
    country: "Mexico",
    countryKey: "Mexico",
    lat: 19.4326,
    lng: -99.1332,
    mapX: 175,
    mapY: 260,
    scientist: {
      id: "mario_molina",
      name: "Mario Molina",
      gender: "M",
      subjects: ["chemistry"],
      era: "1943–2020",
      fact: "Showed how CFCs destroy ozone — work that helped protect Earth's atmosphere.",
      gcseLink: "Atmosphere chemistry, pollution, and the ozone layer.",
      photo: commonsScientistPhoto("Mario_Molina_(headshot).jpg")
    }
  },
  {
    id: "sao_paulo",
    name: "São Paulo",
    country: "Brazil",
    countryKey: "Brazil",
    lat: -23.5505,
    lng: -46.6333,
    mapX: 310,
    mapY: 405,
    scientist: {
      id: "johanna_dobereiner",
      name: "Johanna Döbereiner",
      gender: "F",
      subjects: ["biology"],
      era: "1924–2000",
      fact: "Showed how soil bacteria fix nitrogen for crops — transforming sustainable agriculture.",
      gcseLink: "Nitrogen cycle, bacteria, and ecosystems.",
      photo: commonsScientistPhoto("Johanna-Döbereiner.jpg")
    }
  },
  {
    id: "toronto",
    name: "Toronto",
    country: "Canada",
    countryKey: "Canada",
    lat: 43.6532,
    lng: -79.3832,
    mapX: 235,
    mapY: 175,
    scientist: {
      id: "roberta_bondar",
      name: "Roberta Bondar",
      gender: "F",
      subjects: ["biology"],
      era: "1945–",
      fact: "Canada's first female astronaut and a neurologist who studied how the body adapts in space.",
      gcseLink: "Nervous system, homeostasis, and human biology.",
      photo: commonsScientistPhoto("Roberta_Bondar.jpg")
    }
  },
  {
    id: "tehran",
    name: "Tehran",
    country: "Iran",
    countryKey: "Iran",
    lat: 35.6892,
    lng: 51.389,
    mapX: 585,
    mapY: 220,
    scientist: {
      id: "maryam_mirzakhani",
      name: "Maryam Mirzakhani",
      gender: "F",
      subjects: ["physics"],
      era: "1977–2017",
      fact: "First woman to win the Fields Medal — for breakthroughs in geometry and curved surfaces.",
      gcseLink: "Waves, geometry of space, and mathematical models in science.",
      photo: commonsScientistPhoto("Maryam_Mirzakhani_in_Seoul_2014.jpg")
    }
  },
  {
    id: "moscow",
    name: "Moscow",
    country: "Russia",
    countryKey: "Russia",
    lat: 55.7558,
    lng: 37.6173,
    mapX: 554,
    mapY: 145,
    scientist: {
      id: "sofia_kovalevskaya",
      name: "Sofia Kovalevskaya",
      gender: "F",
      subjects: ["physics"],
      era: "1850–1891",
      fact: "Made breakthroughs in mathematics of motion and was the first woman appointed to a full professorship in northern Europe.",
      gcseLink: "Forces, motion, and using mathematics to model the physical world.",
      photo: commonsScientistPhoto("Sofja_Wassiljewna_Kowalewskaja_1.jpg")
    }
  },
  {
    id: "singapore",
    name: "Singapore",
    country: "Singapore",
    countryKey: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
    mapX: 732,
    mapY: 335,
    scientist: {
      id: "jackie_ying",
      name: "Jackie Y. Ying",
      gender: "F",
      subjects: ["chemistry"],
      era: "1966–",
      fact: "Nanotechnology pioneer whose materials work supports medical diagnostics and clean energy.",
      gcseLink: "Materials, nanoparticles, and applications of chemistry.",
      photo: null
    }
  }
];
export function getLocationById(id) {
  return JOURNEY_LOCATIONS.find((loc) => loc.id === id) || null;
}

export function formatLocationLabel(loc) {
  if (!loc) return "";
  return `${loc.name}, ${loc.country}`;
}

/** Great-circle distance in km (haversine). */
export function haversineKm(a, b) {
  if (!a || !b) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h))));
}

export function getScientistForLocation(locationId, { dominantSubject } = {}) {
  const loc = getLocationById(locationId);
  if (!loc?.scientist) return null;
  const scientist = { ...loc.scientist, country: loc.countryKey, locationId: loc.id, locationLabel: formatLocationLabel(loc) };
  if (dominantSubject && !scientist.subjects.includes(dominantSubject)) {
    // Still return the location's scientist — one per city by design
  }
  return scientist;
}

export function defaultJourneyState() {
  return {
    current_location_id: START_LOCATION_ID,
    visited: [START_LOCATION_ID],
    path: [START_LOCATION_ID],
    distance_travelled: 0,
    pending_destination_id: null,
    km_toward_pending: 0
  };
}

export function normalizeJourneyState(raw) {
  const base = defaultJourneyState();
  if (!raw || typeof raw !== "object") return base;
  const visited = Array.isArray(raw.visited) && raw.visited.length
    ? [...raw.visited]
    : base.visited;
  const path = Array.isArray(raw.path) && raw.path.length ? [...raw.path] : [...visited];
  const current = getLocationById(raw.current_location_id)?.id || START_LOCATION_ID;
  if (!visited.includes(START_LOCATION_ID)) visited.unshift(START_LOCATION_ID);
  if (!visited.includes(current) && current === START_LOCATION_ID) {
    /* already ensured */
  }
  return {
    current_location_id: current,
    visited,
    path,
    distance_travelled: Math.max(0, Number(raw.distance_travelled) || 0),
    pending_destination_id: getLocationById(raw.pending_destination_id)?.id || null,
    km_toward_pending: Math.max(0, Number(raw.km_toward_pending) || 0)
  };
}

/**
 * Apply earned XP km toward a pending destination.
 * Returns { state, arrived, destination } if a city was reached.
 */
export function applyTravelProgress(journeyState, xpEarned) {
  const state = normalizeJourneyState(journeyState);
  const earned = Math.max(0, Number(xpEarned) || 0);
  if (!earned || !state.pending_destination_id) {
    return { state, arrived: false, destination: null };
  }

  const from = getLocationById(state.current_location_id);
  const to = getLocationById(state.pending_destination_id);
  if (!from || !to) return { state, arrived: false, destination: null };

  const legKm = haversineKm(from, to);
  state.km_toward_pending += earned;

  if (state.km_toward_pending < legKm) {
    return { state, arrived: false, destination: null };
  }

  // Arrive (excess km does not carry to next leg — kept simple)
  const travelled = legKm;
  state.distance_travelled += travelled;
  state.current_location_id = to.id;
  if (!state.visited.includes(to.id)) state.visited.push(to.id);
  state.path.push(to.id);
  state.pending_destination_id = null;
  state.km_toward_pending = 0;

  return { state, arrived: true, destination: to, legKm: travelled };
}

export function availableTravelBudget(journeyState, totalXp, { ignorePending = false } = {}) {
  const state = normalizeJourneyState(journeyState);
  const reserved = !ignorePending && state.pending_destination_id ? state.km_toward_pending : 0;
  return Math.max(0, (Number(totalXp) || 0) - state.distance_travelled - reserved);
}

/** Set next destination if reachable with remaining XP budget. */
export function canAffordLeg(journeyState, totalXp, destinationId, { ignorePending = false } = {}) {
  const state = normalizeJourneyState(journeyState);
  const from = getLocationById(state.current_location_id);
  const to = getLocationById(destinationId);
  if (!from || !to || from.id === to.id) return { ok: false, reason: "invalid" };
  if (state.pending_destination_id && !ignorePending) return { ok: false, reason: "in_transit" };

  const legKm = haversineKm(from, to);
  const remaining = availableTravelBudget(state, totalXp, { ignorePending });
  if (legKm > remaining) {
    return { ok: false, reason: "insufficient_xp", legKm, remaining, shortfall: legKm - remaining };
  }
  return { ok: true, legKm, remaining };
}

/**
 * Choose next destination.
 * If budget covers the full leg, arrive immediately; otherwise start in-transit progress.
 * Pass { replacePending: true } to abandon the current flight and retarget.
 */
export function selectDestination(journeyState, totalXp, destinationId, { replacePending = false } = {}) {
  let state = normalizeJourneyState(journeyState);
  const from = getLocationById(state.current_location_id);
  const to = getLocationById(destinationId);
  if (!from || !to || from.id === to.id) {
    return { ok: false, reason: "invalid", state };
  }

  const previousDestinationId = state.pending_destination_id;
  if (previousDestinationId && !replacePending) {
    return { ok: false, reason: "in_transit", state, pendingDestinationId: previousDestinationId };
  }
  if (previousDestinationId && replacePending && destinationId === previousDestinationId) {
    return { ok: false, reason: "same_destination", state };
  }

  // Abandon current flight — reserved progress returns to the travel budget
  if (previousDestinationId && replacePending) {
    state = {
      ...state,
      pending_destination_id: null,
      km_toward_pending: 0
    };
  }

  const legKm = haversineKm(from, to);
  const remaining = availableTravelBudget(state, totalXp);
  if (remaining <= 0) {
    return { ok: false, reason: "insufficient_xp", legKm, remaining, shortfall: legKm, state };
  }

  // Immediate arrival when budget covers the whole leg
  if (remaining >= legKm) {
    state.distance_travelled += legKm;
    state.current_location_id = to.id;
    if (!state.visited.includes(to.id)) state.visited.push(to.id);
    state.path.push(to.id);
    state.pending_destination_id = null;
    state.km_toward_pending = 0;
    return {
      ok: true,
      arrived: true,
      state,
      legKm,
      destination: to,
      changed: Boolean(previousDestinationId && replacePending),
      previousDestinationId: previousDestinationId || null
    };
  }

  // Start / retarget journey — apply all available budget toward this leg
  state.pending_destination_id = to.id;
  state.km_toward_pending = remaining;
  return {
    ok: true,
    arrived: false,
    state,
    legKm,
    destination: to,
    progressKm: remaining,
    changed: Boolean(previousDestinationId && replacePending),
    previousDestinationId: previousDestinationId || null
  };
}

/** Convenience wrapper — change destination while already flying. */
export function changeDestination(journeyState, totalXp, destinationId) {
  return selectDestination(journeyState, totalXp, destinationId, { replacePending: true });
}

export function getWorldProgress(distanceTravelled) {
  const km = Math.max(0, Number(distanceTravelled) || 0);
  return {
    km,
    halfPct: Math.min(100, Math.round((km / HALF_WORLD_KM) * 100)),
    fullPct: Math.min(100, Math.round((km / FULL_WORLD_KM) * 100)),
    halfComplete: km >= HALF_WORLD_KM,
    fullComplete: km >= FULL_WORLD_KM,
    kmToHalf: Math.max(0, HALF_WORLD_KM - km),
    kmToFull: Math.max(0, FULL_WORLD_KM - km)
  };
}

export function representationStats() {
  const women = JOURNEY_LOCATIONS.filter((l) => l.scientist.gender === "F").length;
  const africa = JOURNEY_LOCATIONS.filter((l) =>
    ["Egypt", "Ghana", "Nigeria", "Kenya", "SouthAfrica"].includes(l.countryKey)
  ).length;
  return { total: JOURNEY_LOCATIONS.length, women, africa, womenPct: Math.round((women / JOURNEY_LOCATIONS.length) * 100) };
}
