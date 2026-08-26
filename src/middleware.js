import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Middleware protects:
 *   /dashboard  — admin UI
 *   /api/leads  — lead data
 *   /api/properties — property data
 *   /api/email-templates — email templates
 *   /api/reports — property email reports
 *   /api/cron   — cron triggers
 *
 * Public routes (no auth needed):
 *   /              — landing
 *   /login         — login page
 *   /results/[token] — client-facing results
 *   /api/webhook/* — external webhooks (WPForms etc.)
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ---- Allow public routes through immediately ----
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/results") ||
    pathname.startsWith("/tour-confirmation") ||
    pathname.startsWith("/api/webhook") ||
    pathname.startsWith("/api/tour-confirmation") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // ---- For protected routes, check Supabase session ----
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This refreshes the session if expired — MUST be called
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated — redirect to login (pages) or return 401 (API)
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/leads/:path*",
    "/api/properties/:path*",
    "/api/cron/:path*",
  ],
};
