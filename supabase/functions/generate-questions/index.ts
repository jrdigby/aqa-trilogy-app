import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const MAX_QUESTIONS = 12;
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function buildPrompt(payload) {
  const {
    spec_ref,
    topic_name,
    spec_text,
    subject,
    paper,
    tier,
    recipes
  } = payload;

  const recipeLines = (recipes || [])
    .map((r, i) => `${i + 1}. ${r.question_type} · demand ${r.demand_level}`)
    .join("\n");

  return `You are an expert AQA GCSE Combined Science (8464) question author for UK students aged 14–16.

Write original exam-style questions ONLY from the specification content below. British English. No trick questions. Scientifically accurate.

SPEC CONTEXT
- Subject: ${subject}
- Paper: ${paper}
- Spec reference: ${spec_ref}
- Topic: ${topic_name}
- Tier band for wording: ${tier} (both = suitable for shared FT/HT where possible)
- Specification text:
"""
${spec_text}
"""

Generate exactly ${recipes?.length || 0} questions, one per recipe line:
${recipeLines}

RULES
- MCQ: exactly 4 options; "correct" must exactly match one option string; include specific "option_feedback" for each WRONG option (array of {option, feedback}); optional brief "overall_feedback" for Section 3.
- short_text: 2 marks default; include exactly 2 mark_points with "keywords" (use pipe for synonyms e.g. charge|electric charge) and "feedback" for each; use describe/explain appropriate command words.
- demand_level: low | standard | standard_45 | standard_67 | high_89 as given in recipe.
- command_word: AQA style (state, give, describe, explain, etc.).
- AO marks must sum to max_marks (MCQ: 1; short_text: 2 with ao1_marks=1, ao2_marks=1 unless HT explain needs AO3).
- Prompts must not contain line breaks inside the string.

Return ONLY valid JSON (no markdown):
{
  "questions": [
    {
      "question_type": "mcq",
      "demand_level": "low",
      "command_word": "state",
      "prompt": "...",
      "max_marks": 1,
      "ao1_marks": 1,
      "ao2_marks": 0,
      "ao3_marks": 0,
      "options": ["...", "...", "...", "..."],
      "correct": "...",
      "option_feedback": [
        {"option": "wrong option text exactly", "feedback": "..."}
      ],
      "overall_feedback": "..."
    },
    {
      "question_type": "short_text",
      "demand_level": "standard",
      "command_word": "describe",
      "prompt": "...",
      "max_marks": 2,
      "ao1_marks": 1,
      "ao2_marks": 1,
      "ao3_marks": 0,
      "mark_points": [
        {"ao": "AO1", "keywords": "term|synonym", "feedback": "..."},
        {"ao": "AO2", "keywords": "...", "feedback": "..."}
      ]
    }
  ]
}`;
}

function extractJson(text) {
  const trimmed = String(text || "").trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI response did not contain JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callGemini(prompt) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return extractJson(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Invalid session" }, 401);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (profile?.role !== "developer") {
      return jsonResponse({ error: "Developer role required" }, 403);
    }

    const payload = await req.json();
    const recipes = Array.isArray(payload?.recipes) ? payload.recipes : [];

    if (!payload?.spec_text?.trim()) {
      return jsonResponse({ error: "spec_text is required" }, 400);
    }
    if (!recipes.length) {
      return jsonResponse({ error: "At least one recipe is required" }, 400);
    }
    if (recipes.length > MAX_QUESTIONS) {
      return jsonResponse({ error: `Maximum ${MAX_QUESTIONS} questions per request` }, 400);
    }

    const prompt = buildPrompt(payload);
    const parsed = await callGemini(prompt);
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

    if (questions.length !== recipes.length) {
      return jsonResponse({
        questions,
        warnings: [`Expected ${recipes.length} questions, got ${questions.length}`],
        model: MODEL
      });
    }

    return jsonResponse({ questions, model: MODEL });
  } catch (err) {
    console.error("generate-questions error:", err);
    return jsonResponse({ error: err?.message || "Generation failed" }, 500);
  }
});
