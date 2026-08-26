import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "./supabase-server";

// ---------- browser / public client ----------
export function getSupabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// ---------- server / service-role client ----------
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Get the current authenticated user from the request context (Server Components / Route Handlers)
 * Returns the Supabase auth user object or null if not authenticated
 */
export async function getSupabaseUser() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    console.error("Error getting user:", err);
    return null;
  }
}

/**
 * Get the current user's account from the accounts table
 * Returns { id, user_id, email, name } or null if not found
 */
export async function getUserAccount() {
  try {
    const user = await getSupabaseUser();
    if (!user) return null;

    const supabase = getSupabaseAdmin();
    const { data: account, error } = await supabase
      .from("accounts")
      .select("id, user_id, email, name")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error getting account:", error);
      return null;
    }

    return account;
  } catch (err) {
    console.error("Error in getUserAccount:", err);
    return null;
  }
}
