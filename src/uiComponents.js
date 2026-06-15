// src/uiComponents.js
import { escapeHtml } from './utils.js';
import { isFuzzyMatch, highlightCommandWordsInPrompt } from './evalEngine.js';
import { XP_RULES_FOOTNOTE } from './xpEngine.js';
import { renderCalculationWorkflow, renderCalculationStepSummary } from './calculationWorkflow.js';

// Dom element selector shortcut helper used internally
const el = (id) => document.getElementById(id);

// ====== GLOBAL TOAST NOTIFICATION BANNER ======
export function showToastBanner(msg, isError = true, durationMs = 5000) {
  let banner = el("toastBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "toastBanner";
    banner.style = "position: fixed; top: 16px; right: 16px; z-index: 9999; max-width: min(420px, calc(100vw - 32px)); padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; color: white; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0; transform: translateY(-20px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); line-height: 1.35;";
    document.body.appendChild(banner);
  }
  banner.textContent = msg;
  banner.style.background = isError ? "#ef4444" : "#10b981";
  banner.style.opacity = "1";
  banner.style.transform = "translateY(0)";
  setTimeout(() => {
    banner.style.opacity = "0";
    banner.style.transform = "translateY(-20px)";
  }, durationMs);
}

// ====== QUESTION VIEW INJECTION COMPILER ======
export function renderQuestionLayout(q, commandWordBanner, currentKey, layoutOptions = {}) {
  const { presentation = "practice", equationSheet = null } = layoutOptions;
  const totalMarks = q.max_marks || (q.question_type === "extended_response" ? 6 : 1);
  const marksLabel = totalMarks === 1 ? "1 mark" : `${totalMarks} marks`;

  let imageHtml = q.image_url 
    ? `<img src="${q.image_url}" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e2e8f0; display: block;">` 
    : "";

  let html = `
    <div class="item">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px; margin-bottom: 8px;">
        <div style="font-weight: 700; font-size: 1rem; line-height: 1.4; color: var(--text);">${highlightCommandWordsInPrompt(q.prompt)}</div>
        <span class="chip" style="background: #e2e8f0; color: #475569; font-weight: 700; font-size: 0.76rem; padding: 3px 8px; border-radius: 6px; white-space: nowrap; flex-shrink: 0; align-self: flex-start; border: 1px solid #cbd5e1;">
          ${marksLabel}
        </span>
      </div>
      ${imageHtml}
      ${commandWordBanner}
    </div>
  `;

  if (q.question_type === "mcq") {
    const opts = Array.isArray(q.options) ? q.options : [];
    html += `
      <div class="mcq-container" style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
        ${opts.map(o => `
          <label class="mcq-option" style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: #ffffff;">
            <input type="radio" name="mcq" value="${escapeHtml(o)}" style="cursor: pointer; accent-color: var(--primary);"/>
            <span>${escapeHtml(o)}</span>
          </label>
        `).join("")}
      </div>
    `;
  } 
  else if (q.question_type === "numeric") {
    html += renderCalculationWorkflow(q, currentKey, presentation, equationSheet);
  } 
  else if (q.question_type === "extended_response") {
    html += `
      <div class="item">
        <textarea id="txtAns" rows="8" style="width:100%;padding:12px;border-radius:10px;border:1px solid #ccc;background:#ffffff;color:#000000;font-size:0.95rem;line-height:1.5;" placeholder="Draft your detailed scientific explanation here..."></textarea>
        <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 0.78rem; color: #64748b; font-weight: 600;">
          <span id="charCount">0 characters</span>
          <span id="wordCount">0 words (aim for 100-200)</span>
        </div>
      </div>
    `;
  } else {
    html += `<div class="item"><textarea id="txtAns" rows="4" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;background:#ffffff;color:#000000" placeholder="Type your text response here..."></textarea></div>`;
  }

  return html;
}

// ====== STANDARD MARK SCHEME FEEDBACK LAYOUT ENGINE ======
export function renderFeedback(marking, currentQ, currentKey, currentMarkPoints) {
  const pct = Math.round((marking.total / marking.max) * 100);
  const isPerfect = marking.total === marking.max;

  let html = `<div><span class="${isPerfect ? "good" : "bad"}">${isPerfect ? "Correct" : "Not quite"}</span> — ${marking.total}/${marking.max} (${pct}%)</div>`;
  html += `<hr/>`;
  
  html += `<div style="margin-top: 10px; margin-bottom: 5px;"><strong>GCSE Assessment Objectives (AO) Breakdown</strong></div>`;
  html += `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">`;
  
  const aosConfig = [
    { id: "AO1", name: "AO1: Knowledge &amp; Understanding", desc: "Demonstrate knowledge and understanding of scientific ideas, processes, techniques, and procedures.", color: "#3b82f6", bg: "#f8fafc", textCol: "#1e3a8a", badgeBg: "#10b981", badgeBgZero: "#cbd5e1" },
    { id: "AO2", name: "AO2: Application of Science", desc: "Apply knowledge and understanding of scientific ideas, processes, techniques, and procedures in theoretical and practical contexts.", color: "#10b981", bg: "#f8fafc", textCol: "#065f46", badgeBg: "#10b981", badgeBgZero: "#cbd5e1" },
    { id: "AO3", name: "AO3: Analysis &amp; Evaluation", desc: "Analyse, interpret, and evaluate scientific information, ideas, and evidence to make judgements, draw conclusions, and develop procedures.", color: "#f59e0b", bg: "#f8fafc", textCol: "#78350f", badgeBg: "#10b981", badgeBgZero: "#cbd5e1" }
  ];

  aosConfig.forEach(ao => {
    const maxVal = marking.maxAo?.[ao.id] || 0;
    if (maxVal > 0) {
      const earnedVal = marking.ao?.[ao.id] || 0;
      const badgeColor = earnedVal > 0 ? ao.badgeBg : ao.badgeBgZero;
      
      html += `
        <div style="font-size: 0.85rem; padding: 8px 12px; background: ${ao.bg}; border-left: 4px solid ${ao.color}; border-radius: 0 6px 6px 0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: ${ao.textCol};">${ao.name}</span> 
            <span class="chip" style="font-weight: 700; background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px;">${earnedVal}/${maxVal} marks</span>
          </div>
          <div style="font-size: 0.76rem; color: #475569; margin-top: 4px; line-height: 1.3;">${ao.desc}</div>
        </div>
      `;
    }
  });

  html += `</div>`;

  if (currentQ.question_type === "numeric" && marking.stepResults) {
    html += renderCalculationStepSummary(marking.stepResults);
  }

  if (currentQ.question_type === "short_text" && currentKey && currentKey.key_type === "keywords") {
    let allTargetKeywords = [];
    if (currentMarkPoints && currentMarkPoints.length > 0) {
      allTargetKeywords = currentMarkPoints.map(mp => mp.point_text).filter(Boolean);
    } else {
      const required = currentKey.key_payload.required || [];
      const optional = currentKey.key_payload.optional || [];
      allTargetKeywords = [...required, ...optional];
    }
    
    const studentRawText = (el("txtAns")?.value || "").trim();
    const tokens = studentRawText.split(/(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()?])/);
    
    const highlightedStudentTokens = tokens.map(token => {
      if (/^[\s.,\/#!$%\^&\*;:{}=\-_`~()?]/g.test(token) || !token) return escapeHtml(token);
      
      let bestMatch = null;
      let highestType = null; 
      
      for (const targetExpr of allTargetKeywords) {
        const synonyms = targetExpr.split('|').map(s => s.trim().toLowerCase());
        for (const syn of synonyms) {
          if (token.toLowerCase() === syn) {
            bestMatch = syn;
            highestType = 'exact';
            break; 
          } else if (isFuzzyMatch(token, syn, 0.85)) {
            bestMatch = syn;
            highestType = 'fuzzy';
          }
        }
        if (highestType === 'exact') break;
      }
      
      if (highestType === 'exact') {
        return `<span class="match-exact" title="Exact match for: ${escapeHtml(bestMatch)}">${escapeHtml(token)}</span>`;
      } else if (highestType === 'fuzzy') {
        return `<span class="match-fuzzy" style="background-color: #fff7ed; color: #9a3412; border-bottom: 2px solid #f97316;" title="Spelling correction target: ${escapeHtml(bestMatch)}">${escapeHtml(token)} <b style="font-weight:700;">[spelling: ${escapeHtml(bestMatch)}]</b></span>`;
      }
      
      return escapeHtml(token);
    });

    const highlightedTargetsHTML = allTargetKeywords.map(targetExpr => {
      const studentWords = studentRawText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/);
      const synonyms = targetExpr.split('|').map(s => s.trim().toLowerCase());
      
      const hasExact = synonyms.some(syn => {
        const cleanRaw = studentRawText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").replace(/\s+/g, " ").trim();
        return cleanRaw.includes(syn) || studentWords.some(w => w === syn);
      });
      
      const hasFuzzy = !hasExact && synonyms.some(syn => 
        studentWords.some(w => isFuzzyMatch(w, syn, 0.85))
      );
      
      const displayLabel = targetExpr.replace(/\|/g, " / ");
      
      if (hasExact) {
        return `<span class="keyword-badge" style="border-color: #10b981; background: #e6f4ea; color: #137333;">🟢 ${escapeHtml(displayLabel)}</span>`;
      } else if (hasFuzzy) {
        return `<span class="keyword-badge" style="border-color: #f97316; background: #fff7ed; color: #9a3412;">🟠 ${escapeHtml(displayLabel)}</span>`;
      } else {
        return `<span class="keyword-badge" style="opacity: 0.6;">⚪ ${escapeHtml(displayLabel)}</span>`;
      }
    }).join(" ");

    html += `<hr/>`;
    html += `<div style="margin-bottom: 12px;"><strong>Your Answer Analysis:</strong></div>`;
    html += `<div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; font-size: 0.95rem; line-height: 1.6; margin-bottom: 15px; color: #0f172a;">${highlightedStudentTokens.join("")}</div>`;
    
    html += `<div><strong>Syllabus Target Keywords:</strong></div>`;
    html += `<div style="margin-top: 6px; margin-bottom: 10px;">${highlightedTargetsHTML}</div>`;
  }

  if (marking.missing && marking.missing.length > 0) {
    html += `<hr/><div><strong>How to improve</strong></div>`;
    html += marking.missing.map(m => {
      let feedbackImgHtml = m.image_url 
        ? `<div style="margin-top: 8px; max-width: 100%;">
             <img src="${m.image_url}" style="max-width: 100%; max-height: 180px; object-fit: contain; border: 1px solid #fed7d7; border-radius: 6px; display: block;" alt="Feedback diagram" />
           </div>` 
        : "";

      const isEcf = !!m.isEcf;
      const containerBg = isEcf ? "#f0fdf4" : "#fff5f5";
      const borderCol = isEcf ? "#10b981" : "#ff4d4d";
      const textCol = isEcf ? "#166534" : "#0f172a";
      const badgeBg = isEcf ? "#dcfce7" : "#ff4d4d";
      const badgeColor = isEcf ? "#166534" : "white";
      const badgeLabel = isEcf ? "ECF" : m.ao;

      return `
        <div class="item" style="margin: 5px 0; padding: 12px; background: ${containerBg}; border-left: 4px solid ${borderCol}; border-radius: 0 6px 6px 0; color: ${textCol};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
            <div>
              <span class="chip" style="background:${badgeBg}; color:${badgeColor}; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-right: 5px; font-weight: bold; text-transform: uppercase;">
                ${badgeLabel}
              </span> 
              ${escapeHtml(m.text)}
              ${feedbackImgHtml}
            </div>
            ${m.url ? `
              <a href="${m.url}" target="_blank" rel="noopener noreferrer" 
                 style="flex-shrink: 0; display: inline-block; padding: 4px 10px; background: #4f46e5; color: white; text-decoration: none; font-size: 0.8rem; font-weight: 600; border-radius: 6px; transition: background 0.15s;">
                Review Resource ↗
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");
  } else {
    html += `<hr/><div class="good">Nice — perfect marks on this specification point!</div>`;
  }
  return html;
}

// ====== AI GRADER EXPERT PANELS VIEW SYSTEM ======
export function renderLiveAIFeedback(evaluation, hasImprovedCurrentQ) {
  const score = evaluation.score_total || 0;
  const max = evaluation.score_max || 6;
  const level = evaluation.level_achieved || "Level 1";
  const pct = Math.round((score / max) * 100);

  let html = `
    <div style="background: #fafbfc; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
        <div>
          <span style="font-size: 1.1rem; font-weight: 800; color: #1e293b;">🤖 AI GCSE Examiner Evaluation</span>
          <div style="font-size: 0.74rem; color: #64748b; font-weight: 600; margin-top: 2px;">GRADED IN SECURE SANDBOX AGAINST AQA SCIENTIFIC BLUEPRINTS</div>
        </div>
        <div style="text-align: right;">
          <div style="background: #4f46e5; color: white; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">
            ${level} (${score}/${max} Marks)
          </div>
          <div style="font-size: 0.72rem; font-weight: 700; color: #4f46e5; margin-top: 3px;">${pct}% Success</div>
        </div>
      </div>

      <div style="margin-top: 15px; margin-bottom: 15px;">
        <strong style="font-size: 0.82rem; color: #1e293b; display: block; margin-bottom: 8px;">Cognitive Mark Split:</strong>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 0.78rem; padding: 6px 10px; background: #f8fafc; border-left: 3px solid #3b82f6; border-radius: 0 4px 4px 0; display: flex; justify-content: space-between;">
            <span style="font-weight: 700; color: #1e3a8a;">AO1: Knowledge &amp; Procedural Recall</span>
            <span style="font-weight: 700;">${evaluation.ao_breakdown?.AO1 || 0}/${Math.ceil(max/3)} marks</span>
          </div>
          <div style="font-size: 0.78rem; padding: 6px 10px; background: #f8fafc; border-left: 3px solid #10b981; border-radius: 0 4px 4px 0; display: flex; justify-content: space-between;">
            <span style="font-weight: 700; color: #065f46;">AO2: Application to Experimental Method</span>
            <span style="font-weight: 700;">${evaluation.ao_breakdown?.AO2 || 0}/${Math.floor(max/3)} marks</span>
          </div>
          <div style="font-size: 0.78rem; padding: 6px 10px; background: #f8fafc; border-left: 3px solid #f59e0b; border-radius: 0 4px 4px 0; display: flex; justify-content: space-between;">
            <span style="font-weight: 700; color: #78350f;">AO3: Error Mitigation &amp; Parallax Evaluation</span>
            <span style="font-weight: 700;">${evaluation.ao_breakdown?.AO3 || 0}/${max - Math.ceil(max/3) - Math.floor(max/3)} marks</span>
          </div>
        </div>
      </div>

      <div>
        <strong style="font-size: 0.82rem; color: #0f172a; display: block; margin-bottom: 4px;">🟢 Demonstrated Scientific Concepts:</strong>
        <ul style="margin: 0; padding-left: 20px; font-size: 0.82rem; color: #334155; line-height: 1.4;">
          ${evaluation.analysis_highlights?.map(h => `<li style="margin-bottom: 3px;">${escapeHtml(h)}</li>`).join("")}
        </ul>
      </div>

      <div style="margin-top: 14px;">
        <strong style="font-size: 0.82rem; color: #991b1b; display: block; margin-bottom: 4px;">⚠️ Missing Details or Misconceptions:</strong>
        <ul style="margin: 0; padding-left: 20px; font-size: 0.82rem; color: #334155; line-height: 1.4;">
          ${evaluation.missing_or_incorrect?.length 
            ? evaluation.missing_or_incorrect.map(m => `<li style="margin-bottom: 3px; color: #991b1b;">${escapeHtml(m)}</li>`).join("")
            : `<li style="color: #15803d; list-style-type: none; padding-left:0;">No scientific gaps identified. Exceptional work!</li>`}
        </ul>
      </div>

      <div style="margin-top: 18px; padding: 12px 14px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);">
        <strong style="font-size: 0.8rem; color: #1e40af; display: block; margin-bottom: 4px;">🎯 Actionable Coach Recommendation to move up a grade:</strong>
        <p style="font-size: 0.78rem; color: #1e3a8a; line-height: 1.4; margin: 0;">
          ${escapeHtml(evaluation.actionable_improvement_advice)}
        </p>
      </div>

      ${evaluation.improved_answer ? `
        <div style="margin-top: 18px; padding: 14px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 8px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); border: 1px solid #dcfce7;">
          <strong style="font-size: 0.82rem; color: #14532d; display: block; margin-bottom: 6px;">✨ AI Coach's Model Answer Suggestion:</strong>
          <p style="font-size: 0.8rem; color: #166534; line-height: 1.5; margin: 0; white-space: pre-wrap; font-family: inherit;">
            ${escapeHtml(evaluation.improved_answer)}
          </p>
        </div>
      ` : ''}

      ${(score < max && !hasImprovedCurrentQ) ? `
        <button id="btnImprove" style="margin-top: 18px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: background 0.2s; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);">
          ✏️ Edit &amp; Resubmit to Improve My Answer
        </button>
      ` : ''}
    </div>
  `;
  return html;
}

// ====== LOCAL COGNITIVE FALLBACK RUBRIC VIEW COMPILER ======
export function renderAQAExtendedResponseFeedback(studentText, rubric, localKeywords, matchedKeywords) {
  const keywordHits = matchedKeywords.length;
  let level = "Level 1";
  let score = 1;
  let summary = "isolated scientific points made. Strategy lacks clear experimental cohesion.";

  const hitFraction = localKeywords.length > 0 ? (keywordHits / localKeywords.length) : 0;
  if (hitFraction >= 0.5) {
    level = "Level 3";
    score = 6;
    summary = "coherent, detailed, logically structured explanation covering key scientific steps with precise physical context.";
  } else if (hitFraction >= 0.25) {
    level = "Level 2";
    score = 4;
    summary = "most steps identified, but plan lacks clear sequencing or omissions exist in specific details.";
  }

  const pointsList = rubric?.key_scientific_points || [];
  let checklistHtml = "";
  if (pointsList.length > 0) {
    checklistHtml = pointsList.map((pt, i) => `<strong>${i + 1}.</strong> ${escapeHtml(pt)}`).join("<br/><br/>");
  } else {
    checklistHtml = "Compare your answer directly with standard AQA Level mark scheme guidelines to evaluate your progress.";
  }

  let html = `
    <div style="background: #fafbfc; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 1.1rem; font-weight: 800; color: #1e293b;">📊 GCSE Level of Response Evaluation (Local Fallback)</span>
        <span style="background: #3b82f6; color: white; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">${level} (${score}/6 Marks)</span>
      </div>
      
      <p style="font-size: 0.85rem; color: #475569; line-height: 1.4; margin-bottom: 14px;">
        Evaluated locally against <strong>AQA Science Assessment Framework rules</strong>. The response demonstrates <em>${summary}</em>
      </p>

      <div style="margin-top: 15px; margin-bottom: 15px; padding: 14px; background: #fffdf5; border-left: 4px solid #f59e0b; border-radius: 4px;">
        <strong style="font-size: 0.82rem; color: #78350f; display: block; margin-bottom: 8px;">⚠️ GCSE self-assessment checklist (Compare your text):</strong>
        <p style="font-size: 0.8rem; color: #475569; line-height: 1.45; margin-bottom: 0;">
          ${checklistHtml}
        </p>
      </div>

      <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
        Target scientific keywords matching: ${keywordHits} of ${localKeywords.length} targets identified.
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
        ${localKeywords.map(k => {
          const hit = matchedKeywords.includes(k);
          return `<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; border: 1px solid ${hit ? '#a7f3d0' : '#e2e8f0'}; background: ${hit ? '#ecfdf5' : '#f8fafc'}; color: ${hit ? '#065f46' : '#94a3b8'};">${hit ? '🟢' : '⚪'} ${k}</span>`;
        }).join("")}
      </div>
    </div>
  `;
  return html;
}
/**
 * Renders a visual AQA specification mastery grid map
 * @param {Array} allSpecPoints - Complete static target array from DB lookup
 * @param {Array} srsStates - Active records tracking progress
 * @param {Function|null} onCellClickCallback - Handler redirecting view to selected item
 * @param {{ readOnly?: boolean }} [options]
 */
export function renderMasteryHeatmap(allSpecPoints, srsStates, onCellClickCallback, options = {}) {
  const readOnly = !!options.readOnly || onCellClickCallback == null;
  // 1. Pivot user tracking array into a quick hashmap keyed by spec_point_id
  const trackingMap = new Map();
  if (Array.isArray(srsStates)) {
    srsStates.forEach(state => {
      if (state && state.spec_point_id) {
        trackingMap.set(state.spec_point_id, state);
      }
    });
  }

  // Ensure allSpecPoints is a valid array
  const safePoints = Array.isArray(allSpecPoints) ? allSpecPoints : [];

  // 2. Case-insensitive subject filtering logic
  const subjects = {
    biology: safePoints.filter(p => p && p.subject && p.subject.toString().toLowerCase().trim() === 'biology'),
    chemistry: safePoints.filter(p => p && p.subject && p.subject.toString().toLowerCase().trim() === 'chemistry'),
    physics: safePoints.filter(p => p && p.subject && p.subject.toString().toLowerCase().trim() === 'physics')
  };

  console.log("HEATMAP DEBUG - Filter counts:", {
    bio: subjects.biology.length,
    chem: subjects.chemistry.length,
    phys: subjects.physics.length
  });

  // 3. Assemble parent layout template frame with explicit row alignment overrides
  const wrapper = document.createElement("div");
  wrapper.className = "heatmap-container";
  wrapper.innerHTML = `
    <div class="heatmap-header">
      <div>
        <h3 style="margin:0; font-size:1.1rem; color:#1e293b; font-weight:700;">Curriculum Mastery Matrix</h3>
        <p style="margin:2px 0 0 0; font-size:0.8rem; color:#64748b;">Visualizing active tracking intervals vs concept gaps across the AQA Specification footprint</p>
      </div>
    </div>
    <div class="heatmap-body" id="heatmapRowsTarget"></div>
  `;

  const rowsTarget = wrapper.querySelector("#heatmapRowsTarget");

  const subjectLabels = {
    biology: `Biology`,
    chemistry: `Chemistry`,
    physics: `Physics`
  };

  // 4. Map rows independently for each subject track (label paired with its cell row)
  ['biology', 'chemistry', 'physics'].forEach(subKey => {
    const subjectRow = document.createElement("div");
    subjectRow.className = "heatmap-subject-row";

    const labelEl = document.createElement("div");
    labelEl.className = "heatmap-row-label";
    labelEl.textContent = subjectLabels[subKey];

    const rowEl = document.createElement("div");
    rowEl.className = "heatmap-row";

    const targetPoints = subjects[subKey] || [];
    
    targetPoints.forEach(point => {
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      
      const srsRecord = trackingMap.get(point.id);
      let stateClass = "cell-unattempted";
      let baseColor = "#cbd5e1"; 
      let borderStyle = "1px solid #94a3b8";
      let tooltipText = `[${point.spec_ref || "Spec"}] ${point.topic_name || "Topic"} - Not Attempted Yet`;

      if (srsRecord) {
        const reps = srsRecord.repetitions ?? 0;
        const days = srsRecord.interval_days || 0;

        if (reps === 0) {
          stateClass = "cell-scheduled";
          baseColor = "#dbeafe";
          borderStyle = "1px solid #93c5fd";
          tooltipText = `📅 [${point.spec_ref}] ${point.topic_name} - Scheduled (not practised yet)`;
        } else if (days === 0 || (srsRecord.ease_factor && srsRecord.ease_factor < 2.0)) {
          stateClass = "cell-gap";
          baseColor = "#f59e0b";
          borderStyle = "1px solid #d97706";
          tooltipText = `⚠️ [${point.spec_ref}] ${point.topic_name} - Active Concept Gap (Review Needed)`;
        } else {
          borderStyle = "1px solid #166534";
          if (days <= 3) {
            stateClass = "cell-mastery-l1";
            baseColor = "#bbf7d0";
          } else if (days <= 10) {
            stateClass = "cell-mastery-l2";
            baseColor = "#4ade80";
          } else {
            stateClass = "cell-mastery-l3";
            baseColor = "#16a34a";
          }
          tooltipText = `✅ [${point.spec_ref}] ${point.topic_name} - Secure (Interval: ${days} days)`;
        }
      }

      cell.classList.add(stateClass);
      if (readOnly) cell.classList.add("heatmap-cell-readonly");
      cell.style.backgroundColor = baseColor;
      cell.style.border = borderStyle;
      cell.setAttribute(
        "data-tooltip",
        readOnly && typeof onCellClickCallback !== "function"
          ? `${tooltipText} — Student Pro: click to practise`
          : tooltipText
      );

      if (!readOnly) {
        cell.onclick = () => {
          if (typeof onCellClickCallback === "function") {
            onCellClickCallback(point);
          }
        };
      } else {
        cell.classList.add("heatmap-cell-readonly");
      }

      rowEl.appendChild(cell);
    });

    subjectRow.appendChild(labelEl);
    subjectRow.appendChild(rowEl);
    if (rowsTarget) {
      rowsTarget.appendChild(subjectRow);
    }
  });

  return wrapper;
}

// ====== SESSION CONTEXT & SUMMARY ======

export const QUESTION_TYPE_LABELS = {
  mcq: "Multiple Choice",
  numeric: "Numeric / Calculations",
  short_text: "Short Text / Written",
  extended_response: "Extended Response"
};

function formatSubjectLabel(subject) {
  if (!subject) return "Unknown";
  const s = String(subject);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPaperLabel(paper) {
  if (paper === "paper2") return "Paper 2";
  if (paper === "paper1") return "Paper 1";
  return paper || "";
}

export function computeSessionMarksSummary(log) {
  let scoreTotal = 0;
  let scoreMax = 0;
  for (const entry of log || []) {
    scoreTotal += entry.scoreTotal || 0;
    scoreMax += entry.scoreMax || 0;
  }
  return { scoreTotal, scoreMax };
}

export function computeOutcomeTotals(log) {
  const totals = { full: 0, partial: 0, fail: 0, total: 0 };
  for (const entry of log || []) {
    if (entry.outcome === "full") totals.full++;
    else if (entry.outcome === "partial") totals.partial++;
    else totals.fail++;
  }
  totals.total = totals.full + totals.partial + totals.fail;
  return totals;
}

function getMarksColorClass(scoreTotal, scoreMax) {
  if (scoreMax <= 0) return "session-summary-marks--red";
  if (scoreTotal >= scoreMax) return "session-summary-marks--green";
  if (scoreTotal >= Math.ceil(scoreMax / 2)) return "session-summary-marks--amber";
  return "session-summary-marks--red";
}

export function aggregateMarksBySpecPoint(log) {
  const bySpec = new Map();
  for (const entry of log || []) {
    const id = entry.specPointId;
    if (!bySpec.has(id)) {
      bySpec.set(id, {
        specPointId: id,
        specPoint: entry.specPoint,
        marksAchieved: 0,
        marksAvailable: 0
      });
    }
    const row = bySpec.get(id);
    row.marksAchieved += entry.scoreTotal || 0;
    row.marksAvailable += entry.scoreMax || 0;
  }
  return [...bySpec.values()];
}

export function buildSessionSummaryData(attemptLog) {
  const marksSummary = computeSessionMarksSummary(attemptLog);
  const outcomeTotals = computeOutcomeTotals(attemptLog);
  const bySpecPoint = aggregateMarksBySpecPoint(attemptLog);
  const xpTotal = (attemptLog || []).reduce((sum, entry) => sum + (entry.xpEarned || 0), 0);

  const tableTotals = bySpecPoint.reduce(
    (acc, row) => {
      acc.marksAchieved += row.marksAchieved;
      acc.marksAvailable += row.marksAvailable;
      return acc;
    },
    { marksAchieved: 0, marksAvailable: 0 }
  );

  return { marksSummary, outcomeTotals, bySpecPoint, tableTotals, xpTotal };
}

function renderSpecPointRowCell(specPoint) {
  const ref = specPoint?.spec_ref || "";
  const text = specPoint?.spec_text || "Unknown spec point";
  return `
    <div class="session-summary-spec-row">
      ${ref ? `<span class="chip">${escapeHtml(ref)}</span>` : ""}
      <span class="session-summary-spec-row-text">${escapeHtml(text)}</span>
    </div>
  `;
}

export function renderSessionSummaryHeader(meta, marksSummary, xpTotal = 0) {
  const subject = formatSubjectLabel(meta?.subject);
  const paper = formatPaperLabel(meta?.paper);
  const topic = meta?.topic_name || "All topics";
  const { scoreTotal, scoreMax } = marksSummary;
  const marksLabel = scoreMax > 0 ? `${scoreTotal}/${scoreMax}` : "0/0";
  const colorClass = getMarksColorClass(scoreTotal, scoreMax);
  const xpChip =
    xpTotal > 0
      ? `<div class="session-summary-xp">+${xpTotal} <span class="session-summary-xp-label">XP</span></div>`
      : "";

  return `
    <div class="session-summary-header">
      <h3 class="session-summary-title">Session complete</h3>
      <div class="session-summary-meta-row">
        <div class="session-summary-breadcrumb">${escapeHtml(subject)} · ${escapeHtml(paper)} · ${escapeHtml(topic)}</div>
        <div class="session-summary-scores">
          <div class="session-summary-marks ${colorClass}">
            ${escapeHtml(marksLabel)} <span class="session-summary-marks-label">marks</span>
          </div>
          ${xpChip}
        </div>
      </div>
    </div>
  `;
}

export function renderSessionContext(specPoint) {
  if (!specPoint) {
    return `<div class="session-context-inner muted">Specification context unavailable</div>`;
  }
  const subject = formatSubjectLabel(specPoint.subject);
  const paper = formatPaperLabel(specPoint.paper);
  const topic = specPoint.topic_name || "Unknown topic";
  const specRef = specPoint.spec_ref || "";
  const specText = specPoint.spec_text || "";

  return `
    <div class="session-context-inner">
      <div class="session-context-breadcrumb muted">
        ${escapeHtml(subject)} · ${escapeHtml(paper)} · ${escapeHtml(topic)}
      </div>
      <div class="session-context-spec">
        ${specRef ? `<span class="chip">${escapeHtml(specRef)}</span>` : ""}
        <span class="session-context-spec-text">${escapeHtml(specText)}</span>
      </div>
    </div>
  `;
}

export function aggregateOutcomesByQuestionType(log) {
  const byType = {};
  for (const entry of log || []) {
    const type = entry.questionType || "unknown";
    if (!byType[type]) byType[type] = { full: 0, partial: 0, fail: 0 };
    if (entry.outcome === "full") byType[type].full++;
    else if (entry.outcome === "partial") byType[type].partial++;
    else byType[type].fail++;
  }
  return byType;
}

export function aggregateOutcomesBySpecPoint(log) {
  const bySpec = new Map();
  for (const entry of log || []) {
    const id = entry.specPointId;
    if (!bySpec.has(id)) {
      bySpec.set(id, {
        specPointId: id,
        specPoint: entry.specPoint,
        full: 0,
        partial: 0,
        fail: 0
      });
    }
    const row = bySpec.get(id);
    if (entry.outcome === "full") row.full++;
    else if (entry.outcome === "partial") row.partial++;
    else row.fail++;
  }
  return [...bySpec.values()];
}

function formatMarksPercentage(marksAchieved, marksAvailable) {
  if (marksAvailable <= 0) return 0;
  return Math.round((marksAchieved / marksAvailable) * 100);
}

function renderMarksCell(value) {
  return `<span class="marks-count">${value}</span>`;
}

function renderPercentageCell(marksAchieved, marksAvailable) {
  const pct = formatMarksPercentage(marksAchieved, marksAvailable);
  const colorClass = getMarksColorClass(marksAchieved, marksAvailable);
  return `<span class="marks-pct ${colorClass}">${pct}%</span>`;
}

export function renderMarksBreakdownTable(rows, tableTotals) {
  if (!rows.length) {
    return `<div class="muted" style="padding: 12px;">No questions were answered in this session.</div>`;
  }

  const body = rows.map(row => `
    <tr>
      <td class="session-summary-spec-cell">${row.labelHtml || escapeHtml(row.label || "")}</td>
      <td class="marks-cell">${renderMarksCell(row.marksAchieved)}</td>
      <td class="marks-cell">${renderMarksCell(row.marksAvailable)}</td>
      <td class="marks-cell">${renderPercentageCell(row.marksAchieved, row.marksAvailable)}</td>
    </tr>
  `).join("");

  const footer = tableTotals && rows.length > 1 ? `
    <tfoot>
      <tr class="session-summary-totals-row">
        <td><strong>Total</strong></td>
        <td class="marks-cell">${renderMarksCell(tableTotals.marksAchieved)}</td>
        <td class="marks-cell">${renderMarksCell(tableTotals.marksAvailable)}</td>
        <td class="marks-cell">${renderPercentageCell(tableTotals.marksAchieved, tableTotals.marksAvailable)}</td>
      </tr>
    </tfoot>
  ` : "";

  return `
    <table class="session-summary-table">
      <thead>
        <tr>
          <th>Spec point</th>
          <th>Marks achieved</th>
          <th>Marks available</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
      ${footer}
    </table>
  `;
}

function buildSpecPointSummaryRows(bySpecPoint) {
  return bySpecPoint.map(row => ({
    labelHtml: renderSpecPointRowCell(row.specPoint),
    marksAchieved: row.marksAchieved,
    marksAvailable: row.marksAvailable
  }));
}

export function renderExamPaperFeedbackSummary(attemptLog) {
  const withMarking = (attemptLog || []).filter((a) => a.marking);
  if (!withMarking.length) return "";

  const blocks = withMarking.map((att, i) => {
    const m = att.marking;
    const scoreLine = `${m.total}/${m.max} marks`;
    const stepSummary = m.stepResults ? renderCalculationStepSummary(m.stepResults) : "";
    const gaps = (m.missing || [])
      .filter((g) => !g.isEcf)
      .map((g) => `<li style="margin-bottom:6px;">${escapeHtml(g.text)}</li>`)
      .join("");
    const ecf = (m.missing || [])
      .filter((g) => g.isEcf)
      .map((g) => `<li style="margin-bottom:6px;color:#0369a1;">${escapeHtml(g.text)}</li>`)
      .join("");

    return `
      <div class="exam-q-feedback" style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:10px;background:#fff;">
        <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:8px;">
          <strong style="font-size:0.85rem;">Q${i + 1}</strong>
          <span class="chip" style="font-size:0.76rem;">${escapeHtml(scoreLine)}</span>
        </div>
        ${att.promptPreview ? `<p style="font-size:0.78rem;color:#64748b;margin:0 0 8px;line-height:1.4;">${escapeHtml(att.promptPreview)}…</p>` : ""}
        ${stepSummary}
        ${gaps || ecf ? `<ul style="margin:0;padding-left:18px;font-size:0.82rem;line-height:1.4;">${gaps}${ecf}</ul>` : `<p style="margin:0;font-size:0.82rem;color:#059669;">Fully correct.</p>`}
      </div>
    `;
  }).join("");

  return `
    <div class="exam-paper-feedback" style="margin-top:20px;">
      <h3 style="font-size:1rem;margin-bottom:12px;">Paper review — step-by-step feedback</h3>
      ${blocks}
    </div>
  `;
}

export function renderSessionCompleteSummary(meta, attemptLog) {
  const { marksSummary, bySpecPoint, tableTotals, xpTotal } = buildSessionSummaryData(attemptLog);
  const rows = buildSpecPointSummaryRows(bySpecPoint);
  const xpNote =
    xpTotal > 0
      ? `<p class="session-summary-xp-footnote muted">${escapeHtml(XP_RULES_FOOTNOTE)}</p>`
      : "";

  return `
    ${renderSessionSummaryHeader(meta, marksSummary, xpTotal)}
    ${xpNote}
    <div class="session-summary-results">
      ${renderMarksBreakdownTable(rows, tableTotals)}
    </div>
  `;
}

export function renderSpecPointSessionSummary(meta, attemptLog) {
  return renderSessionCompleteSummary(meta, attemptLog);
}

export function renderAnyPracticeSessionSummary(meta, attemptLog) {
  return renderSessionCompleteSummary(meta, attemptLog);
}

export function renderSelfRatingPrompt() {
  return `
    <div class="session-adaptive-rating" id="sessionAdaptiveRating">
      <p class="session-adaptive-rating-title">How did you find those questions?</p>
      <p class="session-adaptive-rating-sub muted">Optional — helps us pick better questions next time</p>
      <div class="session-adaptive-rating-buttons" role="group" aria-label="Difficulty self-rating">
        <button type="button" class="session-rating-btn session-rating-btn--easy" data-rating="easy">
          <span class="session-rating-emoji" aria-hidden="true">😊</span>
          <span class="session-rating-label">Too easy</span>
        </button>
        <button type="button" class="session-rating-btn session-rating-btn--right" data-rating="right">
          <span class="session-rating-emoji" aria-hidden="true">😐</span>
          <span class="session-rating-label">About right</span>
        </button>
        <button type="button" class="session-rating-btn session-rating-btn--hard" data-rating="hard">
          <span class="session-rating-emoji" aria-hidden="true">☹️</span>
          <span class="session-rating-label">Too hard</span>
        </button>
      </div>
    </div>
  `;
}

export function renderAdaptiveFeedback({ offsetChanged, offsetDirection, tierNudge, mode }) {
  const parts = [];

  if (offsetChanged && offsetDirection) {
    const easier = offsetDirection === "easier";
    const msg =
      mode === "spec_point"
        ? easier
          ? "Next time this topic is due, questions may be a bit easier."
          : "Next time this topic is due, questions may be a bit harder."
        : easier
          ? "Next time we'll try slightly easier questions."
          : "Next time we'll try slightly harder questions.";
    parts.push(`<p class="session-adaptive-hint">${escapeHtml(msg)}</p>`);
  }

  if (tierNudge === "consider_ht") {
    parts.push(`
      <div class="session-adaptive-nudge session-adaptive-nudge--tier">
        <strong>Ready for a bigger challenge?</strong>
        You're consistently scoring highly on the hardest Foundation-level questions.
        Consider trying <strong>Higher Tier</strong> in the tier filter.
      </div>
    `);
  } else if (tierNudge === "consider_ft") {
    parts.push(`
      <div class="session-adaptive-nudge session-adaptive-nudge--tier">
        <strong>Finding it tough?</strong>
        You're finding Higher Tier questions difficult.
        Consider switching to <strong>Foundation Tier</strong>, or review the topics above before trying again.
      </div>
    `);
  }

  if (!parts.length) return "";
  return `<div class="session-adaptive-feedback">${parts.join("")}</div>`;
}

// ====== PRACTICE HINTS PANEL ======

export function normalizeQuestionHints(hints) {
  if (!Array.isArray(hints)) return [];
  return hints.map((h) => String(h || "").trim()).filter(Boolean);
}

export function renderHintsPanel(hints, revealedCount, panelOpen) {
  const normalized = normalizeQuestionHints(hints);
  if (!normalized.length) return "";

  const revealed = normalized.slice(0, revealedCount);
  const hasMore = revealedCount < normalized.length;

  const revealedHtml = revealed.length
    ? `<ol class="hints-panel-list" start="1">${revealed
        .map((hint) => `<li class="hints-panel-item">${escapeHtml(hint)}</li>`)
        .join("")}</ol>`
    : "";

  if (!panelOpen) {
    return `
      <div class="hints-panel hints-panel--collapsed">
        <button type="button" class="hints-panel-toggle btn-secondary" id="btnOpenHints">
          💡 Need a hint?
        </button>
      </div>
    `;
  }

  return `
    <div class="hints-panel hints-panel--open">
      <div class="hints-panel-header">
        <span class="hints-panel-title">Hints</span>
        <span class="hints-panel-count muted">${revealedCount} of ${normalized.length} revealed</span>
      </div>
      ${revealedHtml}
      ${
        hasMore
          ? `<button type="button" class="hints-panel-next btn-secondary" id="btnRevealNextHint">Show next hint</button>`
          : `<p class="hints-panel-done muted">No more hints for this question.</p>`
      }
      <p class="hints-panel-xp-note muted">Each hint revealed reduces XP earned for this question.</p>
    </div>
  `;
}