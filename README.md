# Foster & Keys — Apartment Matching System

Real estate lead scoring and apartment/unit matching automation powered by **OpenAI**.  
**Gmail (IMAP) → AI Email Parsing → Supabase → Scoring → Agent Dashboard → Client Results Page**

---

## How It Works

```
┌──────────────┐    IMAP poll   ┌───────────────────┐   OpenAI     ┌──────────┐
│    Gmail     │ ◀─────────────│  /api/cron/       │ ──parses──▶ │ Supabase │
│   Inbox     │   fetch unread │   check-email     │  lead + scores│  DB      │
└──────────────┘                └───────────────────┘              └──────────┘
                                        │                              │
                                        │  1. OpenAI extracts fields   │
                                        │  2. scores lead vs all units │
                                        │  3. OpenAI writes summary    │
                                        ▼                              │
                               ┌───────────────────┐                   │
                               │  Agent Dashboard  │◀──── reads ──────┘
                               │  /dashboard       │
                               └───────────────────┘
                                        │
                                        │  "Send to Client" button
                                        ▼
                               ┌───────────────────┐
                               │  Client Results   │
                               │  /results/[token] │  ← unique link per lead
                               └───────────────────┘
```

### OpenAI Integration

1. **Email Parsing** — When unread emails are pulled from Gmail, `gpt-4o-mini` extracts structured lead data (name, email, budget, location, beds, baths, etc.) from the raw email body. No rigid field mapping needed.
2. **Match Summary** — After scoring, `gpt-4o-mini` writes a 3-5 sentence personalized summary explaining why the top matches suit the client. This summary appears on both the agent dashboard and the client results page.

---

## Quick Start

### 1. Clone & Install

```bash
cd fosterandkeys
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Then run `supabase/seed.sql` to add 35 apartments + their units (Houston & DFW metros)
4. Go to **Settings → API** and grab:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 3. Get an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key with access to `gpt-4o-mini`
3. Copy the key — you'll add it to `.env.local` below

### 4. Set Up Gmail App Password

1. Enable **2-Step Verification** on your Google Account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Generate a password for **Mail** → **Other (Foster & Keys)**
4. Copy the 16-character password

> **Important:** This is a special app password, NOT your regular Gmail password. Google requires 2FA to be enabled first.

### 5. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
GMAIL_USER=youremail@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
WEBHOOK_SECRET=pick-a-random-string
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 6. Enable IMAP in Gmail

1. Open Gmail → Settings (gear icon) → **See all settings**
2. Go to **Forwarding and POP/IMAP** tab
3. Under IMAP access, select **Enable IMAP**
4. Save changes

### 7. Run Locally

```bash
npm run dev
```

- **Dashboard:** http://localhost:3000/dashboard
- **Home:** http://localhost:3000

---

## Gmail Email Intake

Form submissions (WPForms, Contact Form 7, Jotform, etc.) email into your Gmail inbox. The system connects via IMAP to pull unread emails and parse them with OpenAI.

### Manual Check (Dashboard Button)

Click **"📬 Check Gmail"** on the dashboard to immediately pull and process unread emails. New leads appear in the table automatically.

### Automatic Polling (Cron Job)

Set up a cron job to poll every 5 minutes:

```bash
# crontab -e
*/5 * * * * curl -s -X POST https://your-domain.com/api/cron/check-email?secret=your-webhook-secret
```

Or use a service like [cron-job.org](https://cron-job.org) to hit the endpoint on a schedule.

### Endpoint Details

- **URL:** `POST /api/cron/check-email`
- **Auth:** `x-webhook-secret` header or `?secret=` query param (both check `WEBHOOK_SECRET`)
- **Optional body params:**
  - `folder` — IMAP folder to check (default: `"INBOX"`)
  - `filter` — only process emails whose subject contains this string
- **Response:** `{ success, message, processed, total, results[] }`

### How It Works Under the Hood

1. Connects to Gmail via IMAP (TLS, port 993)
2. Fetches all **UNSEEN** (unread) emails from the inbox
3. For each email: OpenAI parses → scores against all units → generates AI summary → saves to Supabase
4. Marks processed emails as **SEEN** (read) so they aren't re-processed

---

## Testing with curl

### Test Gmail Check (manual trigger)

```bash
curl -X POST http://localhost:3000/api/cron/check-email \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-secret-here"
```

### Test with subject filter

```bash
curl -X POST http://localhost:3000/api/cron/check-email \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-secret-here" \
  -d '{ "filter": "New Lead" }'
```

### Test Direct JSON Webhook (structured data)

The WPForms endpoint still works for pre-structured JSON:

```bash
curl -X POST http://localhost:3000/api/webhook/wpform \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-secret-here" \
  -d '{
    "full_name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "555-1234",
    "budget_min": 800,
    "budget_max": 1400,
    "desired_location": "Houston",
    "bedrooms": 1,
    "bathrooms": 1,
    "move_in_timeline": "3 months",
    "notes": "Looking for washer/dryer in unit"
  }'
```

---

## Scoring Logic

Each lead is scored 0-100 against every **unit** based on:

| Criterion     | Weight | Logic                                                          |
|---------------|--------|----------------------------------------------------------------|
| Rent Budget   | 35%    | Full points if rent is within budget min-max; partial credit   |
| Location      | 25%    | Metro area match (Houston / DFW) or city name match            |
| Bedrooms      | 20%    | Full if exact, 60% if off by 1, 20% if off by 2               |
| Bathrooms     | 20%    | Full if exact, 80% if off by 0.5, descending for larger diffs |

Scoring logic lives in `src/lib/scoring.js` and is easy to tweak.

---

## Deployment (Self-Hosted)

```bash
npm run build
npm start          # runs on port 3000
```

Use **nginx** or **Caddy** as a reverse proxy with SSL. Alternatively use PM2:

```bash
npm install -g pm2
pm2 start npm --name fosterandkeys -- start
pm2 save
```

### Deploy to Netlify

1. Push your code to a GitHub repo
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**
3. Select your repo — Netlify auto-detects Next.js and uses the `netlify.toml` config
4. Add your environment variables in **Site settings → Environment variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD`
   - `WEBHOOK_SECRET`
   - `NEXT_PUBLIC_BASE_URL` → set to your Netlify domain (e.g. `https://fosterandkeys.netlify.app`)
5. Deploy — Netlify handles build + serverless functions automatically

### Deploy to AWS (Amplify)

1. Push code to GitHub
2. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
3. **Host web app → Connect repo**
4. Add environment variables in build settings
5. Amplify auto-detects Next.js and deploys with SSR support

### Gmail Cron Job (Production)

Set up external cron to auto-check Gmail every 5 minutes:

```bash
# crontab on your server, or use cron-job.org / Netlify scheduled functions
*/5 * * * * curl -s -X POST https://your-domain.com/api/cron/check-email -H "x-webhook-secret: your-secret"
```

---

## Project Structure

```
fosterandkeys/
├── src/
│   ├── app/
│   │   ├── layout.js              # Root layout with header
│   │   ├── page.js                # Landing page
│   │   ├── globals.css            # All styles (vanilla CSS)
│   │   ├── dashboard/
│   │   │   └── page.js            # Agent dashboard (Check Gmail button)
│   │   ├── results/
│   │   │   └── [token]/
│   │   │       └── page.js        # Client results page (with AI summary)
│   │   └── api/
│   │       ├── cron/
│   │       │   └── check-email/
│   │       │       └── route.js   # Gmail IMAP poller (OpenAI parsing)
│   │       ├── webhook/
│   │       │   └── wpform/
│   │       │       └── route.js   # WPForm JSON webhook (fallback)
│   │       ├── leads/
│   │       │   └── route.js       # GET all leads
│   │       ├── leads/[id]/send/
│   │       │   └── route.js       # POST mark lead as sent
│   │       └── properties/
│   │           └── route.js       # GET all apartments + units
│   ├── lib/
│   │   ├── supabase.js            # Supabase client helpers
│   │   ├── scoring.js             # Scoring engine (0-100 per unit)
│   │   ├── openai.js              # OpenAI: email parsing + match summaries
│   │   └── gmail.js               # Gmail IMAP: fetch & mark unread emails
│   └── components/
│       ├── LeadTable.js           # Dashboard leads table
│       ├── LeadDetail.js          # Lead detail modal (AI summary + raw email)
│       └── UnitCard.js            # Unit card for client results
├── supabase/
│   ├── schema.sql                 # Database schema (apartments, units, leads, lead_matches)
│   └── seed.sql                   # 35 real apartments + units (Houston & DFW)
├── .env.local.example             # Environment template
├── next.config.mjs
├── jsconfig.json
└── package.json
```

---

## Next Steps

- **More apartments:** Add new properties directly to the `apartments` + `units` tables in Supabase
- **Email integration:** Add SendGrid/Resend in `/api/leads/[id]/send` to email the results link automatically
- **Auth:** Add password protection to `/dashboard` if needed
- **Analytics:** Track when clients open their results link
- **Fine-tune OpenAI prompts:** Adjust the system prompts in `src/lib/openai.js` to match your brand voice
