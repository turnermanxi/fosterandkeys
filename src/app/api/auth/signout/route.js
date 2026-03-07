import { createSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * POST /api/auth/signout
 * Signs the user out (clears session cookies).
 */
export async function POST() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
