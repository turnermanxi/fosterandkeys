import { NextResponse } from "next/server";
import { getSupabaseUser, getUserAccount, getSupabaseAdmin } from "./supabase";

/**
 * Middleware function to verify that a lead belongs to the current user's account
 * Should be called at the beginning of protected lead endpoints
 * 
 * Usage in a route handler:
 * ```
 * export async function GET(request, { params }) {
 *   const { id } = await params;
 *   const leadAuthCheck = await verifyLeadOwnership(id);
 *   if (leadAuthCheck.error) return leadAuthCheck.response;
 *   const { lead, account } = leadAuthCheck;
 * ```
 * 
 * @param {string} leadId - The lead ID to verify ownership of
 * @returns { error?: boolean, response?: NextResponse, lead?: object, account?: object }
 */
export async function verifyLeadOwnership(leadId, providedToken = null) {
  try {
    // 1. Check if user is authenticated
    const user = await getSupabaseUser();
    if (!user) {
      return {
        error: true,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    // 2. Get user's account
    const account = await getUserAccount();
    if (!account) {
      return {
        error: true,
        response: NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        ),
      };
    }

    // 3. Verify the lead exists and belongs to this account
    const supabase = getSupabaseAdmin();
    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (error) {
      return {
        error: true,
        response: NextResponse.json({ error: "Lead not found" }, { status: 404 }),
      };
    }

    // 4. Check ownership either via the agent's account OR the client's
    //    results_token capability URL.
    const tokenMatches =
      providedToken && lead.results_token === providedToken;

    if (lead.account_id !== account.id && !tokenMatches) {
      return {
        error: true,
        response: NextResponse.json(
          { error: "Forbidden: Lead does not belong to your account" },
          { status: 403 }
        ),
      };
    }

    // All checks passed
    return { lead, account };
  } catch (err) {
    console.error("Error in verifyLeadOwnership:", err);
    return {
      error: true,
      response: NextResponse.json(
        { error: err.message },
        { status: 500 }
      ),
    };
  }
}

/**
 * Verify that multiple leads belong to the current user's account
 * Useful for bulk operations
 * 
 * @param {string[]} leadIds - Array of lead IDs to verify
 * @returns { error?: boolean, response?: NextResponse, leads?: object[], account?: object }
 */
export async function verifyLeadsOwnership(leadIds) {
  try {
    // 1. Check if user is authenticated
    const user = await getSupabaseUser();
    if (!user) {
      return {
        error: true,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    // 2. Get user's account
    const account = await getUserAccount();
    if (!account) {
      return {
        error: true,
        response: NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        ),
      };
    }

    // 3. Verify all leads exist and belong to this account
    const supabase = getSupabaseAdmin();
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, account_id")
      .in("id", leadIds);

    if (error) {
      return {
        error: true,
        response: NextResponse.json(
          { error: "Error verifying leads" },
          { status: 500 }
        ),
      };
    }

    // 4. Check that all requested leads belong to this account
    const unauthorizedLeads = leads.filter((l) => l.account_id !== account.id);
    if (unauthorizedLeads.length > 0) {
      return {
        error: true,
        response: NextResponse.json(
          {
            error: "Forbidden: Some leads do not belong to your account",
            unauthorizedCount: unauthorizedLeads.length,
          },
          { status: 403 }
        ),
      };
    }

    // All checks passed
    return { leads, account };
  } catch (err) {
    console.error("Error in verifyLeadsOwnership:", err);
    return {
      error: true,
      response: NextResponse.json(
        { error: err.message },
        { status: 500 }
      ),
    };
  }
}
