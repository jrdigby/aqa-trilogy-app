import { supabaseClient } from "./dbClient.js";

const btnImport = document.getElementById("btnImport");
const jsonInput = document.getElementById("jsonInput");
const statusLog = document.getElementById("statusLog");

// Legacy CSV bulk-import panel (btnImport). CSV import now lives in admin.html (btnProcessCsv).
if (!btnImport || !jsonInput || !statusLog) {
  // No-op when this panel is not on the page.
} else {
  wireLegacyCsvImport();
}

function parseCSVToObjects(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(",");
    const row = {};
    headers.forEach((header, idx) => {
      let val = matches[idx] ? matches[idx].trim() : "";
      row[header] = val.replace(/^"|"$/g, "").replace(/""/g, '"');
    });
    result.push(row);
  }
  return result;
}

function wireLegacyCsvImport() {
  btnImport.addEventListener("click", async () => {
    const rawCSV = jsonInput.value.trim();
    if (!rawCSV) {
      alert("Please paste your Excel CSV text data into the input field.");
      return;
    }

    const rawRows = parseCSVToObjects(rawCSV);
    if (rawRows.length === 0) {
      alert("Could not parse any rows. Ensure your headers match exactly.");
      return;
    }

    btnImport.disabled = true;
    btnImport.textContent = `Processing ${rawRows.length} rows...`;
    statusLog.style.display = "block";
    statusLog.innerHTML = "";

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];

      const markPointsArray = [];
      for (let m = 1; m <= 4; m++) {
        const ao = r[`mp${m}_ao`];
        const text = r[`mp${m}_text`];
        if (ao && text) {
          markPointsArray.push({
            ao,
            point_text: text,
            feedback_if_missing: `Review criteria details for mark point ${m}.`,
            max_marks: 1
          });
        }
      }

      let parsedOptions = null;
      if (r.options) {
        parsedOptions = JSON.stringify(r.options.split("|").map((o) => o.trim()));
      }

      let parsedPayload = {};
      try {
        parsedPayload = r.key_payload ? JSON.parse(r.key_payload) : null;
      } catch {
        parsedPayload = { answer: r.key_payload };
      }

      try {
        const { data: newQuestionId, error: rpcError } = await supabaseClient.rpc(
          "bulk_import_full_question",
          {
            p_spec_point_id: r.spec_point_id,
            p_question_type: r.question_type,
            p_prompt: r.prompt,
            p_options: parsedOptions,
            p_difficulty: parseInt(r.difficulty || 1, 10),
            p_tier: r.tier || "both",
            p_resource_links: null,
            p_key_type: r.key_type || r.question_type,
            p_key_payload: parsedPayload,
            p_mark_points_json: markPointsArray.length > 0 ? markPointsArray : null
          }
        );

        if (rpcError) throw rpcError;
        successCount++;

        const line = document.createElement("div");
        line.className = "log-success";
        line.textContent = `[✓] Row ${i + 1} Saved! ID: ${newQuestionId}`;
        statusLog.appendChild(line);
      } catch (err) {
        failCount++;
        const line = document.createElement("div");
        line.className = "log-error";
        line.textContent = `[✗] Row ${i + 1} Failed: ${err.message}`;
        statusLog.appendChild(line);
      }
    }

    btnImport.disabled = false;
    btnImport.textContent = "Execute Database Bulk Transaction Import";
    const done = document.createElement("div");
    done.textContent = `Done. Processed: ${successCount} successfully, Errors: ${failCount}`;
    statusLog.appendChild(done);
  });
}
