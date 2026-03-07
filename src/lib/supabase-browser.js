import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in browser / Client Components.
 * Uses @supabase/ssr so auth cookies are handled automatically.
 */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
