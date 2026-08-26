import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUser, getUserAccount } from "@/lib/supabase";

/**
 * GET /api/leads
 * Returns all leads for the current user's account, ordered newest-first.
 * REQUIRES: User to be authenticated via Supabase Auth
 */
export async function GET() {
  try {
    // 1. Check if user is authenticated
    const user = await getSupabaseUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user's account
    const account = await getUserAccount();
    if (!account) {
      return NextResponse.json(
        { error: "Account not found. Please contact support." },
        { status: 404 }
      );
    }

    // 3. Query leads filtered by account_id
    const supabase = getSupabaseAdmin();
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*, lead_matches(score, unit_id, apartment_id)")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 4. Attach a top_score for convenience
    const enriched = leads.map((l) => {
      const scores = (l.lead_matches ?? []).map((m) => m.score);
      return {
        ...l,
        top_score: scores.length ? Math.max(...scores) : null,
        match_count: scores.length,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("Error in GET /api/leads:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
