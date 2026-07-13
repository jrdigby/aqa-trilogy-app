import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Gemini often emits LaTeX like `\times` / `\frac` inside JSON strings with a
 * single backslash. JSON.parse then interprets `\t`/`\f`/`\b`/`\v` as control
 * characters (TAB + "imes", form-feed + "rac", …). Double those backslashes
 * when followed by a letter so parse preserves the LaTeX command.
 *
 * Intentionally skips `\n` / `\r` — real newlines/returns before letters are
 * common in multi-line answers; post-parse restore covers the control-char cases.
 */
function protectLatexEscapesInJson(raw: string): string {
  return String(raw || "").replace(/\\([bftv])(?=[A-Za-z])/g, "\\\\$1");
}

/**
 * Repairs strings whose LaTeX escapes were already collapsed into control
 * characters (e.g. TAB+"imes" → `\times`). Only control chars immediately
 * followed by a letter are restored.
 */
function restoreMangledLatexEscapes(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/\t(?=[a-zA-Z])/g, "\\t")
    .replace(/\f(?=[a-zA-Z])/g, "\\f")
    .replace(/\v(?=[a-zA-Z])/g, "\\v")
    .replace(/[\b](?=[a-zA-Z])/g, "\\b");
}

function sanitizeEvaluationLatex(value: unknown): unknown {
  if (typeof value === "string") return restoreMangledLatexEscapes(value);
  if (Array.isArray(value)) return value.map(sanitizeEvaluationLatex);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeEvaluationLatex(v);
    }
    return out;
  }
  return value;
}

function parseGeminiEvaluationJson(rawResultText: string) {
  const protectedRaw = protectLatexEscapesInJson(rawResultText);
  const parsed = JSON.parse(protectedRaw);
  return sanitizeEvaluationLatex(parsed);
}

serve(async (req) => {
  // Handle CORS preflight handshakes cleanly
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("====== STARTING EXTENDED RESPONSE EVALUATION ======");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';

    // Step 1: Check server-side environmental credentials
    console.log("Step 1: Checking environment configurations...");
    if (!supabaseUrl) {
      throw new Error("Missing environmental secret: SUPABASE_URL is not set.");
    }
    if (!supabaseServiceKey) {
      throw new Error("Missing environmental secret: SUPABASE_SERVICE_ROLE_KEY is not set.");
    }
    if (!geminiApiKey) {
      throw new Error("Missing environmental secret: GEMINI_API_KEY is not set. Please add this inside your Supabase Secrets panel.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 2: Parse incoming request parameters safely
    console.log("Step 2: Parsing request payload...");
    const { question_id, student_text } = await req.json();
    
    if (!question_id) {
      console.warn("Validation Warning: Received request with missing question_id parameter.");
      return new Response(JSON.stringify({ error: "Missing required parameter: question_id is undefined or null." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (student_text === undefined || student_text === null || student_text.trim() === "") {
      console.warn("Validation Warning: Received empty or whitespace-only student text.");
      return new Response(JSON.stringify({ error: "Missing required parameter: student_text is blank or contains only whitespace." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Payload valid. Question ID: ${question_id} | Text length: ${student_text.length} characters.`);

    // Step 3: Fetch Question specifications from database
    console.log(`Step 3: Querying 'questions' table for ID: ${question_id}...`);
    const { data: q, error: qErr } = await supabase
      .from('questions')
      .select('prompt, max_marks')
      .eq('id', question_id)
      .single();

    if (qErr) {
      console.error(`Database Error querying 'questions' table:`, qErr);
      throw new Error(`Failed to find question in database: ${qErr.message}`);
    }
    if (!q) {
      throw new Error(`Question with ID ${question_id} returned null from database query.`);
    }

    console.log(`Successfully fetched question details. Prompt: "${q.prompt.substring(0, 60)}..." | Max Marks: ${q.max_marks}`);

    // Step 4: Fetch AQA Levels criteria from 'answer_keys' table
    console.log(`Step 4: Querying 'answer_keys' table for Question ID: ${question_id}...`);
    const { data: key, error: keyErr } = await supabase
      .from('answer_keys')
      .select('key_payload')
      .eq('question_id', question_id)
      .single();

    if (keyErr) {
      console.error(`Database Error querying 'answer_keys' table:`, keyErr);
      throw new Error(`Failed to find marking rubric key inside answer_keys table: ${keyErr.message}`);
    }
    if (!key || !key.key_payload) {
      throw new Error(`Marking key guidelines are missing or empty for Question ID: ${question_id}`);
    }

    // Prepare robust prompt parameters from structured DB keys
    const promptText = q.prompt;
    const maxMarks = q.max_marks || 6;
    const guidelines = key.key_payload.marking_guidelines || "Apply standard AQA GCSE combined science assessment rules.";
    const levels = JSON.stringify(key.key_payload.level_descriptors || {});
    const pointsList = JSON.stringify(key.key_payload.key_scientific_points || []);
    const topLevelLabel = maxMarks >= 6 ? "Level 3" : "Level 2";

    console.log("Successfully extracted evaluation blueprints. Compiling examiner system prompt...");

    // Step 5: Draft systemic assessment guidelines for the AI Examiner
    const systemPrompt = `
You are an expert, strict, and fair senior examiner for AQA GCSE Combined Science (Physics/Chemistry/Biology).
Your goal is to mark a student's extended text response against a formal Level of Response (LoR) rubric.

ASSESSMENT PROTOCOL & EVIDENCE RULES:
1. Review the question context, marking criteria guidelines, and official level descriptors carefully.
2. Determine the Level of Response (Level 1, 2, or 3) achieved based on the coherence, sequencing, and physics/chemistry accuracy of the response. For ${maxMarks}-mark questions, the top available band is ${topLevelLabel}.
3. Apply standard AQA criteria penalties: If there is a fundamental misconception in the student's text, cap their overall score at Level 2 (max 4 marks).
4. Distribute the total score across Assessment Objectives (AO1, AO2, AO3) based on the cognitive nature of their statements.
5. The sum of (AO1 + AO2 + AO3) MUST EXACTLY equal the total score awarded (score_total). score_max MUST be ${maxMarks}.
6. Provide objective, clear, and commendable feedback outlining exactly what they successfully demonstrated and what precise conceptual step was missing to reach the next mark level. Include spelling corrections if they misspelled key terms. Use LaTeX-style syntax for math formulas (enclosed in $ for inline, $$ for display).
7. Create an 'improved_answer' which is a perfect ${maxMarks}-mark rewrite of the student's response. This rewrite should act as a direct coaching model. It MUST preserve the student's original voice, tone, vocabulary, and sentence structure where possible, but safely correct any scientific misconceptions, expand on incomplete details, and inject missing AQA keywords to guarantee a top-band (${maxMarks} marks) grade. Keep it plain text (no markdown formatting or bold asterisks inside this string, but use standard spacing and LaTeX math where needed).
8. CRITICAL JSON ESCAPING FOR LATEX: In every string field, write each LaTeX backslash as a double backslash so JSON preserves it. Examples: write \\\\times not \\times; write \\\\frac not \\frac; write \\\\text not \\text. Single-backslash LaTeX escapes are corrupted by JSON parsers.
`;

    const userQuery = `
QUESTION CONTEXT:
- Prompt: "${promptText}"
- Maximum Marks: ${maxMarks}
- Core Marking Guidelines: ${guidelines}
- Levels Descriptors Grid: ${levels}
- Target Scientific Points expected: ${pointsList}

STUDENT RESPONSE TO EVALUATE:
"${student_text}"

Evaluate the student response and reply strictly with a structured JSON object. Do not include any conversational introductions, markdown blocks, or backticks.
Remember: escape every LaTeX backslash as \\\\ inside JSON string values (e.g. $E = \\\\frac{1}{2} k x^{2}$).
`;

    // Step 6: Invoke Google's Gemini 1.5 Flash model (using the stable production-ready endpoint)
    console.log("Step 5: Handshaking with Google Gemini API...");
    // Upgraded: Re-pointed back to v1beta to allow systemInstructions and responseSchemas, using the stable model signature
// Fix: Use the explicit model flavor identifier 'gemini-1.5-flash-latest' to match the v1beta schema directory
// Fix: Route to the natively supported structured model on the beta gateway
const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    const geminiPayload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            score_total: { type: "INTEGER" },
            score_max: { type: "INTEGER" },
            level_achieved: { type: "STRING" },
            ao_breakdown: {
              type: "OBJECT",
              properties: {
                AO1: { type: "INTEGER" },
                AO2: { type: "INTEGER" },
                AO3: { type: "INTEGER" }
              },
              required: ["AO1", "AO2", "AO3"]
            },
            analysis_highlights: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            missing_or_incorrect: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            actionable_improvement_advice: { type: "STRING" },
            improved_answer: { type: "STRING" }
          },
          required: [
            "score_total",
            "score_max",
            "level_achieved",
            "ao_breakdown",
            "analysis_highlights",
            "missing_or_incorrect",
            "actionable_improvement_advice",
            "improved_answer"
          ]
        }
      }
    };

    // Robust Exponential Backoff Retry Strategy for handling Gemini 503 Spikes
    let response;
    const maxRetries = 3;
    let backoffDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload)
      });

      // If hitting high demand/service unavailable, wait and retry
      if (response.status === 503 && attempt < maxRetries) {
        console.warn(`Gemini API experiencing high demand (HTTP 503). Retrying attempt ${attempt} of ${maxRetries} in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        backoffDelay *= 2; // Exponential backoff scaling
      } else {
        break; // Drop out of the retry loop if successful (200) or a critical validation fault (e.g., 400, 403)
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API connection error (HTTP ${response.status}):`, errorText);
      throw new Error(`Gemini API handshake failed: ${response.status} - ${errorText}`);
    }

    // Step 7: Parse AI Examiner Output (protect LaTeX escapes before JSON.parse)
    console.log("Step 6: Parsing raw response packet returned by Gemini...");
    const geminiData = await response.json();
    const rawResultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawResultText) {
      throw new Error("Empty candidate evaluation packet returned from Gemini engine.");
    }

    const parsedEvaluation = parseGeminiEvaluationJson(rawResultText);
    console.log(`Evaluation complete! Awarded Score: ${parsedEvaluation.score_total}/${parsedEvaluation.score_max} | Level: ${parsedEvaluation.level_achieved}`);

    console.log("====== EVALUATION RESOLVED CLEANLY ======");
    return new Response(JSON.stringify(parsedEvaluation), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("🔴 EDGE FUNCTION CRASH:", err);
    
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
