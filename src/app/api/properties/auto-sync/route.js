import { createSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateSyncPreview } from "@/lib/single-sync";

/**
 * GET /api/properties/auto-sync?accountId=xxx
 *
 * Automatically syncs all properties for an account
 * - Fetches real data from source URLs
 * - Compares with current data
 * - Logs changes
 * - Creates review queue entries for manual approval
 *
 * Requires an authenticated agent session. The supplied accountId must
 * belong to the current user (prevents cross-tenant triggers).
 *
 * Returns: { processed: number, updated: number, reviewed: number, errors: [] }
 */
export async function GET(req) {
  try {
    // --- Auth: accept either an authenticated session OR the admin webhook secret (for cron) ---
    const headerSecret = req.headers.get("x-webhook-secret");
    const isAdminCall =
      process.env.WEBHOOK_SECRET && headerSecret === process.env.WEBHOOK_SECRET;

    let account = null;

    if (!isAdminCall) {
      const supabaseServer = await createSupabaseServer();
      const {
        data: { user },
      } = await supabaseServer.auth.getUser();

      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const supabase = getSupabaseAdmin();

      // --- Resolve the caller's own account ---
      const { data: acc } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!acc) {
        return Response.json({ error: "Account not found" }, { status: 404 });
      }
      account = acc;
    }

    const supabase = getSupabaseAdmin();

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return Response.json({ error: "accountId required" }, { status: 400 });
    }

    // --- Non-admin callers may only sync their own account ---
    if (!isAdminCall && account.id !== accountId) {
      return Response.json(
        { error: "Forbidden: accountId does not belong to your account" },
        { status: 403 }
      );
    }

    // Get all properties with source URLs for this account
    const { data: properties, error: fetchError } = await supabase
      .from("properties")
      .select("*")
      .eq("account_id", accountId)
      .not("source_url", "is", null);

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 400 });
    }

    // Get all apartments with source URLs (url field) — account-scoped
    const { data: apartments, error: aptFetchError } = await supabase
      .from("apartments")
      .select("*")
      .eq("account_id", accountId)
      .not("source_url", "is", null);

    if (aptFetchError) {
      console.error("Apartments fetch error:", aptFetchError);
    }

    const allProperties = [
      ...(properties || []).map(p => ({ ...p, _type: 'property' })),
      ...(apartments || []).map(a => ({ ...a, id: `apt_${a.id}`, _type: 'apartment' })),
    ];

    if (allProperties.length === 0) {
      return Response.json({
        message: "No properties with source URLs found",
        processed: 0,
        updated: 0,
        reviewed: 0,
        errors: [],
      });
    }

    // Process each property
    const results = {
      processed: 0,
      updated: 0,
      reviewed: 0,
      errors: [],
    };

    for (const property of allProperties) {
      try {
        // Generate the sync preview inline (shared pipeline with sync-preview route)
        const sync = await generateSyncPreview(property);

        if (!sync.ok) {
          results.errors.push({
            propertyId: property.id,
            error: sync.error || "Failed to sync",
          });
          continue;
        }

        const { comparison, extractedData } = sync;

        // Log the sync
        await supabase.from("property_sync_logs").insert({
          account_id: accountId,
          property_id: property.id,
          source_url: property.source_url || property.url,
          extracted_data: extractedData,
          diff_result: comparison.diff,
          needs_review: comparison.needs_review,
          review_reason: comparison.reasons.join("; "),
          action_taken: comparison.needs_review ? "review_pending" : "updated",
        });

        // If changes need review, add to review queue
        if (
          comparison.needs_review &&
          comparison.diff &&
          comparison.diff.length > 0
        ) {
          await supabase.from("property_review_queue").insert({
            account_id: accountId,
            property_id: property.id,
            proposed_changes: Object.fromEntries(
              comparison.diff.map((d) => [d.field, d.new_value])
            ),
            diff: comparison.diff,
            review_status: "pending",
          });
          results.reviewed++;
        }

        // If no review needed and changes exist, auto-apply
        if (
          !comparison.needs_review &&
          comparison.should_update &&
          comparison.diff &&
          comparison.diff.length > 0
        ) {
          const updateData = Object.fromEntries(
            comparison.diff.map((d) => [d.field, d.new_value])
          );

          const table = property._type === 'apartment' ? 'apartments' : 'properties';
          const actualId = property._type === 'apartment' ? property.id.replace('apt_', '') : property.id;

          await supabase
            .from(table)
            .update(updateData)
            .eq("id", actualId)
            .eq("account_id", accountId);

          results.updated++;
        }

        results.processed++;
      } catch (propError) {
        results.errors.push({
          propertyId: property.id,
          error: propError.message,
        });
      }
    }

    return Response.json(results);
  } catch (error) {
    console.error("Auto-sync error:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
