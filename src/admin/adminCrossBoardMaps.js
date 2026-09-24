/**
 * Admin panel controller: import / validate / edit cross-board equivalence maps.
 * Scaffolding for Phase 1 (Edexcel) — does not invent or verify syllabus content.
 */
import {
  EXAM_BOARD_META,
  EXAM_BOARDS,
  SUBJECTS,
  normalizeExamBoard
} from "../sciencePath.js";
import {
  getCrossBoardMapTemplateTsv,
  parseCrossBoardMapText,
  fetchCrossBoardMaps,
  upsertCrossBoardMapRows,
  setCrossBoardMapValidation,
  updateCrossBoardMapRow,
  deleteCrossBoardMapRow,
  resolveCrossBoardEquivFks,
  CROSS_BOARD_MATCH_QUALITIES
} from "../examBoards/crossBoardEquivalences.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function boardLabel(id) {
  return EXAM_BOARD_META[normalizeExamBoard(id)]?.displayName || id;
}

/**
 * @param {{
 *   supabaseClient: import('@supabase/supabase-js').SupabaseClient,
 *   showAdminToast?: (msg: string, isError?: boolean) => void,
 * }} deps
 */
export function createCrossBoardMapsController(deps) {
  const { supabaseClient, showAdminToast = () => {} } = deps;

  let parsedImport = null;
  let loadedRows = [];
  let busy = false;

  function els() {
    return {
      sourceBoard: document.getElementById("xbMapSourceBoard"),
      targetBoard: document.getElementById("xbMapTargetBoard"),
      subject: document.getElementById("xbMapSubject"),
      onlyValidated: document.getElementById("xbMapOnlyValidated"),
      file: document.getElementById("xbMapFile"),
      paste: document.getElementById("xbMapPaste"),
      report: document.getElementById("xbMapReport"),
      tableBody: document.getElementById("xbMapTableBody"),
      log: document.getElementById("xbMapLog"),
      btnTemplate: document.getElementById("btnXbMapDownloadTemplate"),
      btnValidate: document.getElementById("btnXbMapValidate"),
      btnImport: document.getElementById("btnXbMapImport"),
      btnReload: document.getElementById("btnXbMapReload"),
      btnResolveFks: document.getElementById("btnXbMapResolveFks"),
      disclaimer: document.getElementById("xbMapDisclaimer")
    };
  }

  function log(msg) {
    const { log: logEl } = els();
    if (!logEl) return;
    const stamp = new Date().toISOString().slice(11, 19);
    logEl.textContent += `\n[${stamp}] ${msg}`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setBusy(next) {
    busy = next;
    const { btnValidate, btnImport, btnReload, btnResolveFks } = els();
    [btnValidate, btnImport, btnReload, btnResolveFks].forEach((btn) => {
      if (btn) btn.disabled = next;
    });
  }

  function filters() {
    const e = els();
    return {
      sourceBoard: e.sourceBoard?.value || "aqa",
      targetBoard: e.targetBoard?.value || "edexcel",
      subject: e.subject?.value || null,
      onlyValidated: Boolean(e.onlyValidated?.checked)
    };
  }

  function readImportText() {
    const { paste, file } = els();
    const pasted = paste?.value?.trim() || "";
    if (pasted) return Promise.resolve(pasted);
    const f = file?.files?.[0];
    if (!f) return Promise.resolve("");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsText(f);
    });
  }

  function renderReport(report) {
    const { report: el } = els();
    if (!el) return;
    if (!report) {
      el.innerHTML = "<p class=\"xb-muted\">No import parsed yet.</p>";
      return;
    }
    const dup =
      report.duplicateKeys?.length > 0
        ? `<li>Duplicate keys: ${report.duplicateKeys.length}</li>`
        : "";
    const errList = (report.errors || [])
      .slice(0, 12)
      .map((e) => `<li>Line ${e.line}: ${escapeHtml(e.errors.join("; "))}</li>`)
      .join("");
    el.innerHTML = `
      <p><strong>${report.ok}</strong> / ${report.total} rows OK
        · valid=${report.isValid ? "yes" : "no"}</p>
      <p class="xb-muted">${escapeHtml(report.disclaimer)}</p>
      <ul>
        <li>By quality: ${escapeHtml(JSON.stringify(report.byQuality || {}))}</li>
        <li>By target board: ${escapeHtml(JSON.stringify(report.byTargetBoard || {}))}</li>
        ${dup}
      </ul>
      ${errList ? `<ul class="xb-errors">${errList}</ul>` : ""}
    `;
  }

  function renderTable(rows) {
    const { tableBody } = els();
    if (!tableBody) return;
    if (!rows?.length) {
      tableBody.innerHTML =
        '<tr><td colspan="8" class="xb-muted">No stored mappings for this filter. Import a signed-off TSV when ready — do not invent Edexcel/OCR refs here.</td></tr>';
      return;
    }
    tableBody.innerHTML = rows
      .map((r) => {
        const validated = r.validated_at
          ? `<span class="xb-badge xb-ok">validated</span>`
          : `<span class="xb-badge xb-warn">unverified</span>`;
        const fk =
          (r.source_spec_point_id ? "S" : "·") + "/" + (r.target_spec_point_id ? "T" : "·");
        return `<tr data-id="${escapeHtml(r.id)}">
          <td>${escapeHtml(r.source_subject)}<br><code>${escapeHtml(r.source_spec_ref)}</code></td>
          <td>${escapeHtml(r.source_course_track)} → ${escapeHtml(r.target_course_track)}</td>
          <td>${escapeHtml(boardLabel(r.target_exam_board))}<br><code>${escapeHtml(r.target_spec_ref)}</code></td>
          <td>
            <select data-action="quality" data-id="${escapeHtml(r.id)}" class="select-fit">
              ${CROSS_BOARD_MATCH_QUALITIES.map(
                (q) =>
                  `<option value="${q}"${q === r.match_quality ? " selected" : ""}>${q}</option>`
              ).join("")}
            </select>
          </td>
          <td>${validated}</td>
          <td title="source FK / target FK">${fk}</td>
          <td class="xb-notes">${escapeHtml((r.notes || "").slice(0, 80))}</td>
          <td class="xb-actions">
            <button type="button" class="btn btn-secondary" data-action="toggle-valid" data-id="${escapeHtml(r.id)}" data-validated="${r.validated_at ? "1" : "0"}">${r.validated_at ? "Clear sign-off" : "Mark signed-off"}</button>
            <button type="button" class="btn btn-secondary" data-action="delete" data-id="${escapeHtml(r.id)}">Delete</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  async function reload() {
    setBusy(true);
    try {
      const f = filters();
      loadedRows = await fetchCrossBoardMaps(supabaseClient, f);
      renderTable(loadedRows);
      log(
        `Loaded ${loadedRows.length} row(s) for ${boardLabel(f.sourceBoard)} → ${boardLabel(f.targetBoard)}${f.subject ? ` · ${f.subject}` : ""}${f.onlyValidated ? " · validated only" : ""}.`
      );
    } catch (err) {
      const msg = err?.message || String(err);
      log(`Reload failed: ${msg}`);
      showAdminToast(
        /relation|does not exist|schema cache/i.test(msg)
          ? "cross_board_spec_equivalences migration not applied yet."
          : `Reload failed: ${msg}`,
        true
      );
      renderTable([]);
    } finally {
      setBusy(false);
    }
  }

  async function validateImport() {
    setBusy(true);
    try {
      const text = await readImportText();
      if (!text.trim()) {
        showAdminToast("Paste a TSV/CSV or choose a file first.", true);
        return;
      }
      parsedImport = parseCrossBoardMapText(text);
      renderReport(parsedImport.report);
      log(
        `Validated import: format=${parsedImport.format}, ${parsedImport.report.ok}/${parsedImport.report.total} OK.`
      );
      if (!parsedImport.report.isValid) {
        showAdminToast("Import has validation errors — fix before upserting.", true);
      } else {
        showAdminToast(
          `Validation OK (${parsedImport.report.ok} rows). Still unverified until you mark signed-off.`,
          false
        );
      }
    } catch (err) {
      showAdminToast(err.message || String(err), true);
      log(`Validate failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  async function importRows() {
    if (!parsedImport?.rows?.length) {
      await validateImport();
    }
    if (!parsedImport?.report?.isValid) {
      showAdminToast("Fix validation errors before importing.", true);
      return;
    }
    const okRows = parsedImport.rows.filter((r) => r.ok).map((r) => r.row);
    if (!okRows.length) {
      showAdminToast("No valid rows to import.", true);
      return;
    }
    setBusy(true);
    try {
      const result = await upsertCrossBoardMapRows(supabaseClient, okRows, {
        markValidated: false,
        dryRun: false
      });
      log(
        `Upserted ${result.upserted}/${result.attempted}. Failed: ${result.failed.length}. Rows remain unverified until explicit sign-off.`
      );
      if (result.failed.length) {
        result.failed.slice(0, 5).forEach((f) => log(`  fail: ${f.error}`));
      }
      showAdminToast(
        `Imported ${result.upserted} mapping(s) as unverified.`,
        result.failed.length > 0
      );
      await reload();
    } catch (err) {
      showAdminToast(err.message || String(err), true);
      log(`Import failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  async function onTableClick(ev) {
    const btn = ev.target.closest("[data-action]");
    if (!btn || busy) return;
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    if (!id) return;

    if (action === "delete") {
      if (!confirm("Delete this cross-board mapping row?")) return;
      setBusy(true);
      try {
        await deleteCrossBoardMapRow(supabaseClient, id);
        showAdminToast("Mapping deleted.");
        await reload();
      } catch (err) {
        showAdminToast(err.message || String(err), true);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action === "toggle-valid") {
      const currently = btn.getAttribute("data-validated") === "1";
      setBusy(true);
      try {
        await setCrossBoardMapValidation(supabaseClient, id, !currently);
        showAdminToast(currently ? "Sign-off cleared." : "Marked signed-off.");
        await reload();
      } catch (err) {
        showAdminToast(err.message || String(err), true);
      } finally {
        setBusy(false);
      }
    }
  }

  async function onTableChange(ev) {
    const sel = ev.target.closest("select[data-action='quality']");
    if (!sel || busy) return;
    const id = sel.getAttribute("data-id");
    setBusy(true);
    try {
      await updateCrossBoardMapRow(supabaseClient, id, { match_quality: sel.value });
      log(`Updated match_quality for ${id} → ${sel.value}`);
    } catch (err) {
      showAdminToast(err.message || String(err), true);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([getCrossBoardMapTemplateTsv()], {
      type: "text/tab-separated-values;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cross_board_equivalence_map_template.tsv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function resolveFks() {
    const f = filters();
    setBusy(true);
    try {
      const result = await resolveCrossBoardEquivFks(supabaseClient, {
        sourceBoard: f.sourceBoard,
        targetBoard: f.targetBoard
      });
      log(`FK resolve: ${JSON.stringify(result)}`);
      showAdminToast("FK resolve finished (validated_at unchanged).");
      await reload();
    } catch (err) {
      showAdminToast(err.message || String(err), true);
      log(`FK resolve failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  function fillBoardSelects() {
    const { sourceBoard, targetBoard, subject } = els();
    if (sourceBoard && !sourceBoard.options.length) {
      EXAM_BOARDS.forEach((id) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = boardLabel(id);
        if (id === "aqa") opt.selected = true;
        sourceBoard.appendChild(opt);
      });
    }
    if (targetBoard && !targetBoard.options.length) {
      EXAM_BOARDS.filter((id) => id !== "aqa").forEach((id) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = `${boardLabel(id)}${EXAM_BOARD_META[id]?.active ? "" : " (inactive)"}`;
        if (id === "edexcel") opt.selected = true;
        targetBoard.appendChild(opt);
      });
    }
    if (subject && subject.options.length <= 1) {
      subject.innerHTML =
        '<option value="">All subjects</option>' +
        SUBJECTS.map((s) => `<option value="${s}">${s}</option>`).join("");
    }
  }

  function mount() {
    fillBoardSelects();
    const e = els();
    if (e.disclaimer) {
      e.disclaimer.textContent =
        "Scaffolding only. Do not invent Edexcel/OCR syllabus wording. Imported rows stay unverified until you explicitly mark them signed-off after spec review.";
    }
    e.btnTemplate?.addEventListener("click", downloadTemplate);
    e.btnValidate?.addEventListener("click", () => validateImport());
    e.btnImport?.addEventListener("click", () => importRows());
    e.btnReload?.addEventListener("click", () => reload());
    e.btnResolveFks?.addEventListener("click", () => resolveFks());
    e.tableBody?.addEventListener("click", onTableClick);
    e.tableBody?.addEventListener("change", onTableChange);
    [e.sourceBoard, e.targetBoard, e.subject, e.onlyValidated].forEach((el) => {
      el?.addEventListener("change", () => reload());
    });
  }

  return {
    mount,
    reload,
    validateImport,
    importRows,
    getLoadedRows: () => loadedRows.slice(),
    getParsedImport: () => parsedImport
  };
}
