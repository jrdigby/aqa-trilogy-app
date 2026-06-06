// ====== Supabase Client Initialization ======
const SUPABASE_URL = "https://cbycwfhczyvzzhthpgsw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xD75RVd3kyvxs3IK_WsNag_eoCAZF4W";           
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const btnImport = document.getElementById("btnImport");
const jsonInput = document.getElementById("jsonInput"); // This is now a CSV text input area!
const statusLog = document.getElementById("statusLog");

// Simple CSV parser utility that handles quotes safely
function parseCSVToObjects(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];
  
  // Clean headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const result = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // Split by comma but respect enclosed double quotes
    const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    const row = {};
    headers.forEach((header, idx) => {
      let val = matches[idx] ? matches[idx].trim() : '';
      row[header] = val.replace(/^"|"$/g, '').replace(/""/g, '"'); // strip bounding and unescape quotes
    });
    result.push(row);
  }
  return result;
}

btnImport.onclick = async () => {
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
    
    // 1. Reconstruct the structural nested Mark Points array dynamically from Excel columns
    const markPointsArray = [];
    for (let m = 1; m <= 4; m++) {
      const ao = r[`mp${m}_ao`];
      const text = r[`mp${m}_text`];
      if (ao && text) {
        markPointsArray.push({
          ao: ao,
          point_text: text,
          feedback_if_missing: `Review criteria details for mark point ${m}.`,
          max_marks: 1
        });
      }
    }

    // 2. Parse payload blocks safely
    let parsedOptions = null;
    if (r.options) {
      parsedOptions = JSON.stringify(r.options.split('|').map(o => o.trim()));
    }

    let parsedPayload = {};
    try {
      parsedPayload = r.key_payload ? JSON.parse(r.key_payload) : null;
    } catch(e) {
      parsedPayload = { "answer": r.key_payload }; // Fallback text fallback wrapper
    }

    // 3. Fire transaction straight to Supabase RPC
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
  addLog(`🏁 Done. Processed: ${successCount} successfully, Errors: ${failCount}`);
};
