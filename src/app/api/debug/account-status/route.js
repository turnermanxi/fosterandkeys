import { NextResponse } from "next/server";
import { getSupabaseUser, getUserAccount } from "@/lib/supabase";
import { getCurrentAccountId, getOrCreateAccount } from "@/lib/accounts";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/debug/account-status
 * 
 * DEVELOPMENT ENDPOINT - Helps verify Lorenzo's account setup
 * Shows:
 * - Current user info
 * - Account info
 * - Lead count
 * - Any issues
 * 
 * REMOVE THIS IN PRODUCTION
 */
export async function GET(request) {
  try {
    // Get current user
    const user = await getSupabaseUser();
    if (!user) {
      return NextResponse.json(
        {
          authenticated: false,
          message: "Not logged in",
          action: "Login at /login",
        },
        { status: 401 }
      );
    }

    // Get or create account
    const accountId = await getCurrentAccountId();
    if (!accountId) {
      return NextResponse.json(
        {
          authenticated: true,
          user_id: user.id,
          email: user.email,
          account: null,
          message: "Account not found and could not be created",
          action: "Contact support",
        },
        { status: 500 }
      );
    }

    // Get full account details
    const account = await getUserAccount();

    // Get lead count for this account
    const supabase = getSupabaseAdmin();
    const { count: leadCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("account_id", accountId);

    const { count: leadsWithoutAccount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .is("account_id", null);

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
        },
        account: {
          id: account?.id,
          email: account?.email,
          name: account?.name,
        },
        leads: {
          total_with_account: leadCount || 0,
          total_without_account: leadsWithoutAccount || 0,
          migration_status:
            leadsWithoutAccount > 0
              ? "⚠️ MIGRATION NEEDED - Some leads not yet assigned to account"
              : "✅ OK - All leads assigned to account",
        },
        migration_help: {
          message: "See LORENZO_DATA_SAFETY.md for migration instructions",
          step_1: "Check account ID above",
          step_2: "Run SQL: UPDATE leads SET account_id = '{{ account_id }}' WHERE account_id IS NULL",
          step_3: "Refresh this page to verify",
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in GET /api/debug/account-status:", err);
    return NextResponse.json(
      {
        error: err.message,
        note: "This is a development endpoint - check LORENZO_DATA_SAFETY.md",
      },
      { status: 500 }
    );
  }
}
