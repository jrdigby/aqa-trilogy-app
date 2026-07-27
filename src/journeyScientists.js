/** Scientist helpers for the interactive journey — backed by journeyLocations.js */

import {
  JOURNEY_LOCATIONS,
  getLocationById,
  getScientistForLocation,
  formatLocationLabel
} from "./journeyLocations.js";

export const JOURNEY_COUNTRIES = [...new Set(JOURNEY_LOCATIONS.map((l) => l.countryKey))];

export const COUNTRY_FLAGS = {
  UK: "🇬🇧",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Italy: "🇮🇹",
  Sweden: "🇸🇪",
  Egypt: "🇪🇬",
  Ghana: "🇬🇭",
  Nigeria: "🇳🇬",
  Kenya: "🇰🇪",
  SouthAfrica: "🇿🇦",
  India: "🇮🇳",
  China: "🇨🇳",
  Japan: "🇯🇵",
  Australia: "🇦🇺",
  NewZealand: "🇳🇿",
  USA: "🇺🇸",
  Mexico: "🇲🇽",
  Brazil: "🇧🇷",
  Canada: "🇨🇦",
  Iran: "🇮🇷",
  Russia: "🇷🇺",
  Singapore: "🇸🇬"
};

export const COUNTRY_DISPLAY_NAMES = Object.fromEntries(
  JOURNEY_LOCATIONS.map((l) => [l.countryKey, l.country])
);

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scientistInitials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Portrait with initials fallback when photo is missing or fails to load. */
export function renderScientistPhoto(scientist, { size = "md" } = {}) {
  if (!scientist) return "";
  const initials = scientistInitials(scientist.name);
  const wrapCls = `scientist-photo-wrap scientist-photo-wrap--${size}`;
  const photoCls = `scientist-photo scientist-photo--${size}`;
  const placeholder = `<div class="${photoCls} scientist-photo--placeholder" aria-hidden="true">${escapeHtml(initials)}</div>`;
  if (!scientist.photo) {
    return `<span class="${wrapCls}">${placeholder}</span>`;
  }
  return `
    <span class="${wrapCls}">
      <img
        class="${photoCls}"
        src="${escapeHtml(scientist.photo)}"
        alt="${escapeHtml(scientist.name)}"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        onerror="const wrap=this.parentElement; this.remove(); const fallback=wrap && wrap.querySelector('.scientist-photo--placeholder'); if(fallback) fallback.hidden=false;"
      />
      <div class="${photoCls} scientist-photo--placeholder" hidden aria-hidden="true">${escapeHtml(initials)}</div>
    </span>`;
}

/** @deprecated Prefer getScientistForLocation — kept for older call sites */
export function getScientistSpotlight(countryOrLocationId, { dominantSubject } = {}) {
  const byId = getScientistForLocation(countryOrLocationId, { dominantSubject });
  if (byId) return byId;
  const loc = JOURNEY_LOCATIONS.find((l) => l.countryKey === countryOrLocationId);
  return loc ? getScientistForLocation(loc.id, { dominantSubject }) : null;
}

export function getScientistsForCountry(countryKey) {
  return JOURNEY_LOCATIONS
    .filter((l) => l.countryKey === countryKey)
    .map((l) => getScientistForLocation(l.id))
    .filter(Boolean);
}

export function renderScientistCard(scientist, { compact = false } = {}) {
  if (!scientist) {
    return `<div class="scientist-card scientist-card--empty muted">Choose a city on the map to meet its scientist.</div>`;
  }
  const subjects = (scientist.subjects || [])
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" · ");
  const place = scientist.locationLabel || COUNTRY_DISPLAY_NAMES[scientist.country] || "";
  const flag = COUNTRY_FLAGS[scientist.country] || "🌍";
  const photo = renderScientistPhoto(scientist, { size: compact ? "sm" : "lg" });

  if (compact) {
    return `
      <div class="scientist-card scientist-card--compact">
        <div class="scientist-card-header">
          ${photo}
          <div>
            <div class="scientist-card-name">${escapeHtml(scientist.name)}</div>
            <div class="scientist-card-meta muted">${escapeHtml(place)}</div>
          </div>
        </div>
        <div class="scientist-card-fact">${escapeHtml(scientist.fact)}</div>
      </div>`;
  }

  return `
    <div class="scientist-card">
      <div class="scientist-card-header">
        ${photo}
        <div class="scientist-card-heading">
          <div class="scientist-card-flag-row">
            <span class="scientist-card-flag">${flag}</span>
            <div class="scientist-card-name">${escapeHtml(scientist.name)}</div>
          </div>
          <div class="scientist-card-meta muted">${escapeHtml(subjects)} · ${escapeHtml(scientist.era || "")}</div>
          ${place ? `<div class="scientist-card-place muted">${escapeHtml(place)}</div>` : ""}
        </div>
      </div>
      <p class="scientist-card-fact">${escapeHtml(scientist.fact)}</p>
      <p class="scientist-card-gcse"><strong>GCSE link:</strong> ${escapeHtml(scientist.gcseLink)}</p>
    </div>`;
}

export function renderPassportGallery(visitedLocationIds = [], { dominantSubject } = {}) {
  const visited = new Set(visitedLocationIds || []);
  const cards = JOURNEY_LOCATIONS.map((loc) => {
    const isVisited = visited.has(loc.id);
    const flag = COUNTRY_FLAGS[loc.countryKey] || "🌍";
    const label = formatLocationLabel(loc);
    if (!isVisited) {
      return `
        <button type="button" class="passport-card passport-card--locked" disabled aria-label="${escapeHtml(label)} not visited yet">
          <span class="passport-card-photo passport-card-photo--locked" aria-hidden="true">❓</span>
          <span class="passport-card-country">${escapeHtml(loc.name)}</span>
          <span class="passport-card-scientist muted">Not visited</span>
        </button>`;
    }
    const scientist = getScientistForLocation(loc.id, { dominantSubject });
    return `
      <button type="button" class="passport-card passport-card--discovered" data-location-id="${escapeHtml(loc.id)}" aria-label="${escapeHtml(label)} — ${escapeHtml(scientist?.name || "")}">
        ${renderScientistPhoto(scientist, { size: "sm" })}
        <span class="passport-card-flag">${flag}</span>
        <span class="passport-card-country">${escapeHtml(loc.name)}</span>
        <span class="passport-card-scientist">${escapeHtml(scientist?.name || "")}</span>
      </button>`;
  }).join("");

  return `
    <div class="passport-gallery" role="list">
      ${cards}
    </div>
    <div id="passportDetailMount" class="passport-detail-mount"></div>`;
}

export { getLocationById, getScientistForLocation, formatLocationLabel };
