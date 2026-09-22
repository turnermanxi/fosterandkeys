import { getSupabaseAdmin } from "@/lib/supabase";
import { scoreLeadAgainstAll, validateUnitMatch } from "@/lib/scoring";
import { generateMatchSummary } from "@/lib/openai";

const TOP_MATCH_LIMIT = 7;
const SUMMARY_MATCH_LIMIT = 5;

/**
 * Fetch apartments and their units scoped to a single account.
 * The legacy global dataset is replaced by per-tenant data: if no accountId
 * is supplied we still honour the query (admin import flows pass one).
 *
 * @param {string|null} accountId
 * @returns {Promise<{ apartments: object[], units: object[], apartmentMap: object }>}
 */
export async function fetchAccountUnits(accountId) {
  const supabase = getSupabaseAdmin();

  let aptQuery = supabase.from("apartments").select("*");
  if (accountId) aptQuery = aptQuery.eq("account_id", accountId);
  const { data: apartments, error: aptErr } = await aptQuery;
  if (aptErr) throw aptErr;

  const apartmentIds = (apartments ?? []).map((a) => a.id);
  let unitQuery = supabase.from("units").select("*");
  if (apartmentIds.length > 0) {
    unitQuery = unitQuery.in("apartment_id", apartmentIds);
  } else {
    unitQuery = unitQuery.in("apartment_id", [0]);
  }
  const { data: units, error: unitErr } = await unitQuery;
  if (unitErr) throw unitErr;

  const apartmentMap = {};
  (apartments ?? []).forEach((a) => (apartmentMap[a.id] = a));

  return {
    apartments: apartments ?? [],
    units: units ?? [],
    apartmentMap,
  };
}

/**
 * Score a lead against the available units, filter out poor/invalid matches,
 * persist the top matches to lead_matches, and (non-fatally) generate the AI summary.
 *
 * @param {object} lead               – inserted lead row
 * @param {object} opts
 * @param {object[]} opts.units       – account-scoped units
 * @param {object}   opts.apartmentMap
 * @returns {Promise<{ aiSummary: string, validMatchCount: number, scoredCount: number, filteredScored: object[] }>}
 */
export async function persistLeadMatches(
  lead,
  { units, apartmentMap }
) {
  const scored = scoreLeadAgainstAll(lead, units ?? [], apartmentMap);

  const validationIssues = {};
  const filteredScored = scored
    .map((s) => {
      const validation = validateUnitMatch(lead, s.unit, s.apartment);
      if (!validation.isValid) {
        if (!validationIssues[s.unit.id]) {
          validationIssues[s.unit.id] = validation;
        }
      }
      return { ...s, validation };
    })
    .filter((s) => {
      if (!lead.desired_location) return s.score > 30;
      const hasLocationMismatch = s.validation.issues.some((i) =>
        i.includes("Location")
      );
      return !hasLocationMismatch && s.score > 25;
    });

  if (Object.keys(validationIssues).length > 0) {
    console.log(`Lead ${lead.id} - Validation issues:`, validationIssues);
  }

  const supabase = getSupabaseAdmin();
  const topScored = filteredScored.slice(0, TOP_MATCH_LIMIT);
  const matches = topScored.map((s) => ({
    lead_id: lead.id,
    unit_id: s.unit.id,
    apartment_id: s.unit.apartment_id,
    score: s.score,
  }));

  if (matches.length) {
    const unitIds = matches.map((m) => m.unit_id);
    await supabase
      .from("lead_matches")
      .delete()
      .eq("lead_id", lead.id)
      .in("unit_id", unitIds);

    const { error: matchErr } = await supabase
      .from("lead_matches")
      .insert(matches);
    if (matchErr) throw matchErr;
  }

  let aiSummary = "";
  try {
    const topMatches = filteredScored.slice(0, SUMMARY_MATCH_LIMIT);
    aiSummary = await generateMatchSummary(lead, topMatches);
    await supabase
      .from("leads")
      .update({ ai_summary: aiSummary })
      .eq("id", lead.id);
  } catch (aiErr) {
    console.error("AI summary generation failed (non-fatal):", aiErr);
  }

  return {
    aiSummary,
    validMatchCount: filteredScored.length,
    scoredCount: scored.length,
    filteredScored,
  };
}

/**
 * Full pipeline: fetch account units, insert the lead, score/persist matches,
 * generate summary. Used by every intake channel (webhook, email, hosted form).
 *
 * @param {object} leadInput – complete lead row (including account_id, results_token, timeline)
 * @param {object} [opts]
 * @param {string|null} [opts.accountId]
 * @param {object[]} [opts.units]        – pre-fetched (skip internal fetch)
 * @param {object}   [opts.apartmentMap]
 * @returns {Promise<{ lead: object, resultsUrl: string, aiSummary: string, matchCount: number }>}
 */
export async function processNewLead(leadInput, opts = {}) {
  const { accountId, units, apartmentMap } = opts;

  const supabase = getSupabaseAdmin();

  const { data: newLead, error: leadErr } = await supabase
    .from("leads")
    .insert(leadInput)
    .select()
    .single();
  if (leadErr) throw leadErr;

  let unitsData = units;
  let apartmentMapData = apartmentMap;
  if (!unitsData || !apartmentMapData) {
    const fetched = await fetchAccountUnits(accountId);
    unitsData = fetched.units;
    apartmentMapData = fetched.apartmentMap;
  }

  const { aiSummary } = await persistLeadMatches(
    newLead,
    {
      units: unitsData,
      apartmentMap: apartmentMapData,
    }
  );

  return {
    lead: newLead,
    resultsUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/results/${newLead.results_token}`,
    aiSummary,
    matchCount: (unitsData ?? []).length,
  };
}