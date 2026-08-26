# AGENTS.md — Foster & Keys

## Project Overview
Foster & Keys is a real estate lead scoring, matching, and management SaaS application for Foster & Keys property management. It ingests leads from WordPress form webhooks and email (Gmail IMAP), scores them with OpenAI, matches them to available properties/units, and handles communication (scheduling tours, sending applications, follow-ups).

## Tech Stack
- **Framework:** Next.js 16 (App Router, `src/` directory)
- **Language:** JavaScript (no TypeScript)
- **Database/Auth:** Supabase (Postgres + Auth + RLS)
- **AI:** OpenAI API (lead scoring, email parsing, property matching)
- **Email:** Gmail IMAP (imapflow + mailparser) for inbound; nodemailer for outbound
- **Deployment:** Netlify (Next.js plugin, scheduled functions for property sync)
- **React:** v19

## Directory Structure
```
src/
  app/                  # Next.js App Router pages & API routes
    api/                # API routes (leads, properties, webhooks, cron, etc.)
    dashboard/          # Main dashboard page
    results/[token]/    # Public client-facing results page
  components/           # React components (LeadTable, LeadDetail, UnitCard, etc.)
  lib/                  # Shared utilities (supabase, openai, scoring, mailer, propertySync, etc.)
  middleware.js          # Next.js middleware (auth protection)
supabase/               # SQL migration files
netlify/                # Netlify scheduled functions (property sync)
```

## Key Commands
- `npm run dev` — Start local dev server
- `npm run build` — Production build
- `npm run lint` — Run Next.js linter
- `npm run test:sync` — Run property sync tests

## Environment Variables
Copy `.env.local.example` to `.env.local` and fill in real values. Required vars:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `GMAIL_USER` / `GMAIL_APP_PASSWORD`
- `WEBHOOK_SECRET`
- `NEXT_PUBLIC_BASE_URL`

## Architecture Notes
- Multi-tenant: each account has isolated leads and properties (account_id on all records)
- Property sync: scrapes property listing URLs, detects duplicates, supports manual + auto sync modes
- Pipeline stages: new → contacted → tour_scheduled → tour_completed → application_sent → approved → leased
- Scheduled Netlify functions sync properties daily at 2 AM and 3 AM UTC
- Webhook endpoint at `/api/webhook/wpform` receives WordPress form submissions
- Cron endpoint at `/api/cron/check-email` polls Gmail for new lead emails

## Code Conventions
- JavaScript (ES modules), no TypeScript
- Next.js App Router conventions (route.js files, page.js files)
- Supabase client created via `src/lib/supabase.js` (separate anon + service-role clients)
- API routes use service-role client for server-side operations
- No comments unless explicitly requested
