import OpenAI from "openai";

let _client;

export function getOpenAI() {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

// ----------------------------------------------------------------
// 1.  Parse a raw email body into structured lead JSON
// ----------------------------------------------------------------

const PARSE_SYSTEM_PROMPT = `You are a data extraction assistant for a real estate company called Foster & Keys.

You will receive the raw text of an email that contains a client's apartment search criteria (submitted via a form, forwarded by an agent, or written freeform).

Extract the following fields and return ONLY valid JSON (no markdown, no explanation):

{
  "full_name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "budget_min": number_or_null,
  "budget_max": number_or_null,
  "desired_location": "string or null — normalise to 'Houston' or 'Dallas' / 'DFW' if possible",
  "bedrooms": number_or_null,
  "bathrooms": number_or_null,
  "move_in_timeline": "string or null",
  "notes": "string or null — anything else relevant the client mentioned"
}

Rules:
- budget values are MONTHLY RENT in USD. If given as a single number treat it as budget_max. Remove $ signs / commas.
- If bedrooms is described as "studio" set bedrooms to 0.
- If a field cannot be determined set it to null.
- Do NOT invent data. Only extract what is present.
- Return raw JSON only. No wrapping, no code fences.`;

/**
 * Use GPT to parse a raw email body into structured lead data.
 * Falls back gracefully if OpenAI is unreachable.
 *
 * @param {string} emailBody  – raw text or HTML of the email
 * @returns {object}  parsed lead fields
 */
export async function parseEmailToLead(emailBody) {
  const openai = getOpenAI();

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PARSE_SYSTEM_PROMPT },
      { role: "user", content: emailBody },
    ],
  });

  const text = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

// ----------------------------------------------------------------
// 2.  Generate a friendly summary of why units matched a lead
// ----------------------------------------------------------------

const SUMMARY_SYSTEM_PROMPT = `You are a helpful real estate assistant writing on behalf of Lorenzo Foster at Foster & Keys.

Given a client's search criteria and a list of matched apartment units with scores, write a short, warm, professional summary (3–5 sentences) explaining:
- What the client is looking for
- Why the top matches are a good fit
- Any trade-offs or things to be aware of (e.g. slightly over budget, fewer bedrooms)
- Encourage them to reach out to Lorenzo with questions

Keep it concise, friendly, and avoid jargon. Use the client's first name. Sign off naturally referencing Lorenzo / Foster & Keys.`;

/**
 * Generate a friendly AI summary of the match results.
 *
 * @param {object}   lead       – the lead record
 * @param {object[]} topMatches – top 5 scored matches [{unit, apartment, score}]
 * @returns {string} human-friendly summary
 */
export async function generateMatchSummary(lead, topMatches) {
  const openai = getOpenAI();

  const matchDescriptions = topMatches.map((m, i) => {
    const u = m.unit ?? m;
    const apt = m.apartment ?? {};
    const rent = u.rent_min ? `$${Number(u.rent_min).toLocaleString()}` : "TBD";
    return `${i + 1}. ${apt.name ?? "Unknown"} — ${u.bedrooms ?? "?"} bed / ${u.bathrooms ?? "?"} bath, ${rent}/mo, ${apt.metro_area === "HOUSTON_METRO" ? "Houston" : "DFW"} area — Score: ${m.score}/100`;
  });

  const userMsg = `Client: ${lead.full_name}
Budget: $${lead.budget_min ?? "?"} – $${lead.budget_max ?? "?"}/mo
Location preference: ${lead.desired_location ?? "Any"}
Bedrooms: ${lead.bedrooms ?? "Any"} | Bathrooms: ${lead.bathrooms ?? "Any"}
Move-in: ${lead.move_in_timeline ?? "Not specified"}
Notes: ${lead.notes ?? "None"}

Top matches:
${matchDescriptions.join("\n")}`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 300,
    messages: [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
  });

  return res.choices[0]?.message?.content ?? "";
}
