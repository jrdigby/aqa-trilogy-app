/** Interactive science journey map — choose destinations, track world progress. */

import {
  JOURNEY_LOCATIONS,
  getLocationById,
  formatLocationLabel,
  haversineKm,
  getScientistForLocation,
  normalizeJourneyState,
  getWorldProgress,
  FULL_WORLD_KM,
  canAffordLeg,
  availableTravelBudget
} from "./journeyLocations.js";
import {
  renderScientistCard,
  renderScientistPhoto,
  renderPassportGallery,
  COUNTRY_FLAGS
} from "./journeyScientists.js";

const MAP_WIDTH = 950;
const MAP_HEIGHT = 620;
const WORLD_MAP_HREF = "images/world-map.svg";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatKm(km) {
  return Number(km || 0).toLocaleString("en-GB");
}

function projectLocation(loc) {
  return { x: loc.mapX, y: loc.mapY };
}

function buildPathD(locationIds) {
  const pts = (locationIds || [])
    .map((id) => getLocationById(id))
    .filter(Boolean)
    .map(projectLocation);
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  return d;
}

function buildPendingPath(from, to, progressT) {
  if (!from || !to) return "";
  const a = projectLocation(from);
  const b = projectLocation(to);
  const t = Math.min(1, Math.max(0, progressT));
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  return {
    line: `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
    progress: `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`,
    traveller: { x, y }
  };
}

export function getJourneySummaryLine(totalXp, journeyState) {
  const state = normalizeJourneyState(journeyState);
  const world = getWorldProgress(state.distance_travelled);
  const current = getLocationById(state.current_location_id);
  const place = current ? formatLocationLabel(current) : "London, United Kingdom";
  const xpNote = totalXp != null ? ` (${formatKm(totalXp)} XP earned)` : "";
  return `You've travelled ${formatKm(world.km)} km on your science journey${xpNote} — currently in ${place}.`;
}

/** @deprecated — region segments removed; kept for any leftover imports */
export function getCurrentRegion() {
  return { country: "UK", label: "United Kingdom" };
}

export function renderJourneyMap({ totalXp = 0, journeyState } = {}) {
  const state = normalizeJourneyState(journeyState);
  const current = getLocationById(state.current_location_id);
  const pending = getLocationById(state.pending_destination_id);
  const visited = new Set(state.visited || []);
  const world = getWorldProgress(state.distance_travelled);
  const remainingBudget = availableTravelBudget(state, totalXp);

  let traveller = projectLocation(current || JOURNEY_LOCATIONS[0]);
  let pendingLine = "";
  let pendingProgress = "";
  let legProgressT = 0;

  if (pending && current) {
    const legKm = haversineKm(current, pending) || 1;
    legProgressT = Math.min(1, state.km_toward_pending / legKm);
    const pendingGeom = buildPendingPath(current, pending, legProgressT);
    pendingLine = pendingGeom.line;
    pendingProgress = pendingGeom.progress;
    traveller = pendingGeom.traveller;
  }

  const completedPath = buildPathD(state.path);

  const markers = JOURNEY_LOCATIONS.map((loc) => {
    const pos = projectLocation(loc);
    const isCurrent = loc.id === state.current_location_id;
    const isPending = loc.id === state.pending_destination_id;
    const isVisited = visited.has(loc.id);
    const inTransit = Boolean(state.pending_destination_id);
    const canStart = !isCurrent && !inTransit;
    const canChange = inTransit && !isCurrent && !isPending;
    const afford = canStart
      ? canAffordLeg(state, totalXp, loc.id)
      : canChange
        ? canAffordLeg(state, totalXp, loc.id, { ignorePending: true })
        : null;
    const fullyReachable = afford?.ok === true;
    const budgetForAction = canStart
      ? availableTravelBudget(state, totalXp)
      : canChange
        ? availableTravelBudget(state, totalXp, { ignorePending: true })
        : 0;
    const hasBudget = (canStart || canChange) && budgetForAction > 0;
    const scientist = getScientistForLocation(loc.id);
    const cls = [
      "journey-landmark",
      isVisited ? "journey-landmark--visited" : "",
      isCurrent ? "journey-landmark--current" : "",
      isPending ? "journey-landmark--pending" : "",
      fullyReachable ? "journey-landmark--reachable" : "",
      hasBudget && !fullyReachable ? "journey-landmark--partial" : "",
      canChange && hasBudget ? "journey-landmark--changeable" : "",
      !isVisited && !hasBudget && !isCurrent && !isPending ? "journey-landmark--locked" : ""
    ].filter(Boolean).join(" ");

    const tipFact = scientist?.fact || "";
    return `
      <g class="${cls}"
         data-location-id="${escapeHtml(loc.id)}"
         data-reachable="${fullyReachable ? "1" : "0"}"
         data-can-start="${canStart && hasBudget ? "1" : "0"}"
         data-can-change="${canChange && hasBudget ? "1" : "0"}"
         data-visited="${isVisited ? "1" : "0"}"
         data-current="${isCurrent ? "1" : "0"}"
         data-pending="${isPending ? "1" : "0"}"
         transform="translate(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})"
         style="cursor: pointer;">
        <circle r="14" class="journey-landmark-hit" fill="transparent" />
        <circle r="6" class="journey-landmark-dot" />
        <title>${escapeHtml(formatLocationLabel(loc))} — ${escapeHtml(scientist?.name || "")}</title>
        <text y="-14" text-anchor="middle" class="journey-landmark-city">${escapeHtml(loc.name)}</text>
        <text y="-3" text-anchor="middle" class="journey-landmark-country">${escapeHtml(loc.country)}</text>
        <foreignObject x="-90" y="12" width="180" height="120" class="journey-hover-fo">
          <div xmlns="http://www.w3.org/1999/xhtml" class="journey-hover-card">
            <div class="journey-hover-name">${escapeHtml(scientist?.name || "")}</div>
            <div class="journey-hover-place">${escapeHtml(formatLocationLabel(loc))}</div>
            <div class="journey-hover-fact">${escapeHtml(tipFact)}</div>
          </div>
        </foreignObject>
      </g>`;
  }).join("");

  const statusLine = pending && current
    ? `<span class="journey-status-flight">Flying to: <strong>${escapeHtml(formatLocationLabel(pending))}</strong></span><span class="journey-status-progress muted">${formatKm(state.km_toward_pending)}/${formatKm(haversineKm(current, pending))} km (${Math.round(legProgressT * 100)}%) · click another city to change</span>`
    : remainingBudget > 0
      ? `<span class="muted">Travel budget: <strong>${formatKm(remainingBudget)} km</strong> — click a highlighted city for your next destination</span>`
      : `<span class="muted">Earn more XP to unlock travel — currently at <strong>${escapeHtml(formatLocationLabel(current))}</strong></span>`;

  return `
    <div class="journey-map-wrap">
      <div class="journey-map-header">
        <span class="journey-map-km">${formatKm(world.km)} km travelled</span>
        <span class="journey-map-budget muted">${formatKm(remainingBudget)} km budget left</span>
      </div>
      <div id="journeyDestinationConfirm" class="journey-destination-confirm hidden" role="region" aria-live="polite"></div>
      <div class="journey-map-status">${statusLine}</div>
      <div class="journey-map-stage">
        <svg class="journey-map-svg" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" role="img" aria-label="Interactive science journey map">
          <rect width="${MAP_WIDTH}" height="${MAP_HEIGHT}" class="journey-map-ocean" rx="8" />
          <image href="${WORLD_MAP_HREF}" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" preserveAspectRatio="none" class="journey-map-image" />
          ${completedPath ? `<path d="${completedPath}" class="journey-route-progress" fill="none" />` : ""}
          ${pendingLine ? `<path d="${pendingLine}" class="journey-route" fill="none" />` : ""}
          ${pendingProgress ? `<path d="${pendingProgress}" class="journey-route-progress journey-route-progress--pending" fill="none" />` : ""}
          ${markers}
          <g class="journey-traveller" transform="translate(${traveller.x.toFixed(1)}, ${traveller.y.toFixed(1)})">
            <circle r="8" class="journey-traveller-pulse" />
            <circle r="5" class="journey-traveller-dot" />
            <text y="-12" text-anchor="middle" class="journey-traveller-icon">✈️</text>
          </g>
        </svg>
        <div id="journeyHoverOverlay" class="journey-hover-overlay hidden" aria-hidden="true"></div>
      </div>
    </div>`;
}

function renderWorldProgressBars(journeyState) {
  const world = getWorldProgress(normalizeJourneyState(journeyState).distance_travelled);
  return `
    <div class="journey-world-progress">
      <div class="journey-world-row">
        <div class="journey-world-label">
          <span>Full way around the world</span>
          <span class="muted">${formatKm(Math.min(world.km, FULL_WORLD_KM))} / ${formatKm(FULL_WORLD_KM)} km</span>
        </div>
        <div class="journey-world-bar">
          <div class="journey-world-bar-fill ${world.fullComplete ? "journey-world-bar-fill--done" : ""}" style="width:${world.fullPct}%"></div>
        </div>
      </div>
    </div>`;
}

export function renderJourneyPanel({
  totalXp = 0,
  dominantSubject,
  journeyState,
  lapCount = 0
} = {}) {
  const state = normalizeJourneyState(journeyState);
  const current = getLocationById(state.current_location_id);
  const scientist = getScientistForLocation(state.current_location_id, { dominantSubject });
  const flag = COUNTRY_FLAGS[current?.countryKey] || "🌍";
  const world = getWorldProgress(state.distance_travelled);
  const visitedCount = (state.visited || []).length;

  return `
    <div class="journey-panel">
      <div class="journey-panel-top">
        <div>
          <h3 class="journey-panel-title">Science Journey</h3>
          <p class="journey-panel-sub muted">Earn XP, then choose your next city. 1 XP = 1 km of travel budget.</p>
        </div>
        ${world.fullComplete || lapCount > 0
          ? `<span class="journey-lap-badge journey-lap-badge--panel">World explorer</span>`
          : world.halfComplete
            ? `<span class="journey-lap-badge journey-lap-badge--panel">Half-way!</span>`
            : ""}
      </div>
      ${renderWorldProgressBars(state)}
      ${renderJourneyMap({ totalXp, journeyState: state })}
      <div class="journey-region-row">
        <span class="journey-region-label">You are in:</span>
        <span class="journey-region-value">${flag} ${escapeHtml(formatLocationLabel(current))}</span>
      </div>
      <div id="journeyScientistMount">
        ${renderScientistCard(scientist)}
      </div>
      <details class="journey-passport" open>
        <summary class="journey-passport-toggle">Scientist Passport (${visitedCount}/${JOURNEY_LOCATIONS.length} cities)</summary>
        ${renderPassportGallery(state.visited, { dominantSubject })}
      </details>
    </div>`;
}

export function wireJourneyInteractions(mount, {
  dominantSubject,
  totalXp,
  journeyState,
  onSelectDestination
} = {}) {
  if (!mount) return;

  const state = normalizeJourneyState(journeyState);
  const overlay = mount.querySelector("#journeyHoverOverlay");
  const stage = mount.querySelector(".journey-map-stage");
  const confirmEl = mount.querySelector("#journeyDestinationConfirm");

  function hideDestinationConfirm() {
    if (!confirmEl) return;
    confirmEl.classList.add("hidden");
    confirmEl.innerHTML = "";
  }

  function showDestinationConfirm(locationId) {
    if (!confirmEl) return;
    const next = getLocationById(locationId);
    const currentPending = getLocationById(state.pending_destination_id);
    if (!next) return;

    const fromLabel = currentPending ? formatLocationLabel(currentPending) : "your current destination";
    const toLabel = formatLocationLabel(next);
    confirmEl.innerHTML = `
      <div class="journey-destination-confirm-inner">
        <p class="journey-destination-confirm-text">
          Change destination from <strong>${escapeHtml(fromLabel)}</strong> to <strong>${escapeHtml(toLabel)}</strong>?
          Flight progress toward the current destination will be cleared.
        </p>
        <div class="journey-destination-confirm-actions">
          <button type="button" class="btn-primary journey-confirm-set" data-location-id="${escapeHtml(locationId)}">Set as new destination</button>
          <button type="button" class="btn-secondary journey-confirm-cancel">Keep current</button>
        </div>
      </div>`;
    confirmEl.classList.remove("hidden");

    confirmEl.querySelector(".journey-confirm-cancel")?.addEventListener("click", hideDestinationConfirm);
    confirmEl.querySelector(".journey-confirm-set")?.addEventListener("click", (ev) => {
      const id = ev.currentTarget?.dataset?.locationId;
      hideDestinationConfirm();
      if (id && typeof onSelectDestination === "function") {
        onSelectDestination(id, { replacePending: true });
      }
    });
  }

  mount.querySelectorAll(".journey-landmark").forEach((g) => {
    const locationId = g.dataset.locationId;
    const loc = getLocationById(locationId);
    const scientist = getScientistForLocation(locationId, { dominantSubject });

    g.addEventListener("pointerenter", (ev) => {
      if (!overlay || !stage || !scientist) return;
      overlay.innerHTML = `
        <div class="journey-hover-card journey-hover-card--floating">
          <div class="journey-hover-header">
            ${renderScientistPhoto(scientist, { size: "sm" })}
            <div>
              <div class="journey-hover-name">${escapeHtml(scientist.name)}</div>
              <div class="journey-hover-place">${escapeHtml(formatLocationLabel(loc))}</div>
            </div>
          </div>
          <div class="journey-hover-fact">${escapeHtml(scientist.fact)}</div>
          <div class="journey-hover-gcse muted"><strong>GCSE:</strong> ${escapeHtml(scientist.gcseLink)}</div>
        </div>`;
      overlay.classList.remove("hidden");
      positionOverlay(overlay, stage, ev);
    });

    g.addEventListener("pointermove", (ev) => {
      if (!overlay || overlay.classList.contains("hidden")) return;
      positionOverlay(overlay, stage, ev);
    });

    g.addEventListener("pointerleave", () => {
      if (!overlay) return;
      overlay.classList.add("hidden");
      overlay.innerHTML = "";
    });

    g.addEventListener("click", () => {
      if (!locationId) return;
      // Current city: show scientist only
      if (g.dataset.current === "1") {
        hideDestinationConfirm();
        const detail = mount.querySelector("#journeyScientistMount");
        if (detail) detail.innerHTML = renderScientistCard(scientist);
        return;
      }
      // Already the pending destination
      if (g.dataset.pending === "1") {
        hideDestinationConfirm();
        const detail = mount.querySelector("#journeyScientistMount");
        if (detail) detail.innerHTML = renderScientistCard(scientist);
        return;
      }
      // Change destination while in transit — ask first
      if (g.dataset.canChange === "1") {
        showDestinationConfirm(locationId);
        return;
      }
      // First-time set destination
      if (g.dataset.canStart === "1") {
        hideDestinationConfirm();
        if (typeof onSelectDestination === "function") {
          onSelectDestination(locationId, { replacePending: false });
        }
        return;
      }
      // Locked / visited preview
      hideDestinationConfirm();
      const detail = mount.querySelector("#journeyScientistMount");
      if (detail) detail.innerHTML = renderScientistCard(scientist);
    });
  });

  mount.querySelectorAll(".passport-card--discovered").forEach((btn) => {
    btn.onclick = () => {
      const locationId = btn.dataset.locationId;
      const scientist = getScientistForLocation(locationId, { dominantSubject });
      const detail = mount.querySelector("#passportDetailMount");
      if (detail) detail.innerHTML = renderScientistCard(scientist);
      const main = mount.querySelector("#journeyScientistMount");
      if (main) main.innerHTML = renderScientistCard(scientist);
    };
  });
}

function positionOverlay(overlay, stage, ev) {
  const rect = stage.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const cardW = 220;
  const left = Math.min(Math.max(8, x + 14), rect.width - cardW - 8);
  const top = Math.min(Math.max(8, y + 14), rect.height - 140);
  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;
}

/** @deprecated */
export function wirePassportGallery(mount, opts = {}) {
  wireJourneyInteractions(mount, opts);
}

export { normalizeJourneyState, getWorldProgress, canAffordLeg, haversineKm, getLocationById };
