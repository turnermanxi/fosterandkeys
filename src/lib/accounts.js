import { getSupabaseAdmin } from "@/lib/supabase";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Get or create an account record for the authenticated user
 * Called on first API access to ensure accounts table entry exists
 */
export async function getOrCreateAccount(userId, userEmail) {
  const supabase = getSupabaseAdmin();

  // First, try to fetch existing account
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    return existing.id;
  }

  // If not found, create new account
  const { data: newAccount, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      email: userEmail,
      name: userEmail.split("@")[0], // Extract name from email
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating account:", error);
    throw error;
  }

  return newAccount.id;
}

/**
 * Get the account ID for the current user (from server context)
 * Requires user to already be authenticated (from middleware)
 */
export async function getCurrentAccountId() {
  const supabase = await createSupabaseServer();

  // Get the authenticated user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  // Get or create account
  return await getOrCreateAccount(user.id, user.email);
}
