# SaaS Conversion Checklist & Architecture Notes

## Current Single-Agent Setup
- ✓ Lead pipeline: recommendations → preferences → tours → applications
- ✓ Multi-round reschedule support
- ✓ Agent assignment (email-based)
- ✓ Email notifications
- ✓ Dashboard & client portal

## Key Changes Needed for SaaS

### 1. Multi-Tenancy (CRITICAL)
```javascript
// Currently: All data is Lorenzo's
// SaaS: Each brokerage is isolated

// Add to database:
- organizations table (brokerages, agencies)
- user_roles table (admin, agent, viewer)
- Add organization_id to: leads, apartments, units, properties, etc.

// Add to API:
- Auth middleware checking organization_id
- Row-level security policies in Supabase
- Tenant isolation on all queries
```

### 2. Authentication & User Management
```javascript
// Currently: Using Supabase anon key, no login
// SaaS: Need proper user accounts

// Required:
- User signup/login (email + password)
- Social auth (Google, etc.)
- Email verification
- Password reset flow
- Role-based access control (RBAC)
  - Brokerage Owner (full access, billing)
  - Agent (manage own leads + assigned)
  - Admin (manage agents, settings)
  - Viewer (read-only)
```

### 3. Agent Management
```javascript
// Currently: Lead.assigned_agent_email = "email@string"
// SaaS: Need actual user accounts

// Schema:
ALTER TABLE leads
ADD COLUMN assigned_agent_id UUID REFERENCES users(id);
-- Remove: assigned_agent_email

// Benefits:
- Agent can login, see their leads in dashboard
- Track agent performance (leads, conversions, commissions)
- Settings per agent (auto-replies, templates)
```

### 4. Email & SMTP Configuration
```javascript
// Currently: Hardcoded to process.env.GMAIL_USER
// SaaS: Each brokerage can customize

// Add:
- email_config table per organization
  - smtp_host, smtp_port, smtp_user, smtp_password
  - from_email, from_name
  - custom reply-to
- Email template customization
  - Override default templates per org
  - Brand colors, logos in emails

// mailer.js needs refactor:
export async function sendEmail(opts) {
  const org = await getOrgEmailConfig(opts.org_id);
  const transport = nodemailer.createTransport(org.smtp_config);
  // ... send with custom config
}
```

### 5. Apartment/Property Data Management
```javascript
// Currently: One shared apartments table
// SaaS: Each org manages their own

// Add columns:
ALTER TABLE apartments
ADD COLUMN organization_id UUID REFERENCES organizations(id);

ALTER TABLE properties
ADD COLUMN organization_id UUID REFERENCES properties(id);

// Only agents see their org's apartments
// Builds competitive advantage (proprietary listings)
```

### 6. Branding & Customization
```javascript
// SaaS needs:
- organizations.branding JSON:
  {
    logo_url: "...",
    primary_color: "#1a3c5e",
    secondary_color: "#10b981",
    company_name: "Foster & Keys",
    website: "fosterandkeys.com",
    phone: "...",
    address: "..."
  }

- Email templates (customizable HTML)
- Dashboard theme customization
- Client portal white-label option
```

### 7. Billing & Subscriptions
```javascript
// Add tables:
- payment_plans
- subscriptions
- usage_logs (track leads, emails sent)
- invoices

// Integrate with:
- Stripe or Paddle for payments
- Webhook handling for subscription events

// Add column to organizations:
ALTER TABLE organizations
ADD COLUMN subscription_status TEXT;
ADD COLUMN subscription_ends_at TIMESTAMPTZ;
```

### 8. Audit Logging
```javascript
// Add audit_logs table:
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  action TEXT,
  resource_type TEXT,
  resource_id UUID,
  changes JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ
);

// Critical for:
- Lead history (who changed what, when)
- Compliance (know who accessed sensitive data)
- Support (debug customer issues)
```

### 9. Data Security
```javascript
// Add:
- Row-level security (RLS) in Supabase
- Encryption for sensitive fields (phone, email for display)
- Rate limiting on API endpoints
- API key auth option (for integrations)
- CORS configuration per org

// Supabase RLS Policy Example:
CREATE POLICY "Users can see their org's leads"
  ON leads
  FOR SELECT
  USING (
    organization_id = auth.user_id() 
    OR organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.user_id()
    )
  );
```

### 10. API for Integrations
```javascript
// Later: Allow integrations with:
- CRM systems
- Email platforms
- SMS services
- Calendar (Google Calendar, Outlook sync)

// Need:
- REST API with API keys
- Webhook support (for external events)
- Rate limiting per plan
- OAuth for third-party apps
```

## Database Migration Order (for SaaS launch)

1. Create `organizations` table
2. Create `users` table with `organization_id` FK
3. Add `organization_id` to all main tables (leads, apartments, properties, units, lead_matches, etc.)
4. Create RLS policies
5. Create `user_organizations` mapping (for multi-org users)
6. Add audit_logs table
7. Add email_config table
8. Update all API routes to check organization_id

## Environment Variables to Add

```bash
# Auth
NEXTAUTH_URL=          # For next-auth or similar
NEXTAUTH_SECRET=       # For sessions

# Payments
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Email (default but overridable per org)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

# Supabase RLS
SUPABASE_SERVICE_ROLE_KEY=  # For server-side operations
```

## Routes/Pages to Add

```
/auth/signup            - Brokerage signup
/auth/login             - User login
/auth/verify-email      - Email verification
/auth/reset-password    - Password reset

/dashboard              - (keep, but add multi-org context)
/settings               - Organization settings
/settings/billing       - Manage subscription
/settings/team          - Manage agents/users
/settings/email         - Email configuration
/settings/templates     - Customize email templates
/settings/branding      - Logo, colors, company info

/admin/organizations    - (if you support multiple orgs)
/admin/users            - (if you manage across orgs)
```

## Performance Considerations for SaaS

- Add indexes on `(organization_id, created_at)` for fast querying
- Consider data archival for old leads (S3 backup, hard delete)
- Rate limit per organization tier
- Cache frequently accessed data (org settings, email config)
- Use database connection pooling (Supabase already does this)

## What's Already Good for SaaS

✅ Lead pipeline architecture is generic & tenant-agnostic
✅ Timeline/event-driven design scales well
✅ Email abstraction already in place (sendEmail functions)
✅ Modular API routes (easy to add auth middleware)
✅ No hardcoded data (all dynamic)

## Quick Priority Ranking (to get to MVP SaaS)

1. **Phase 1 (Must-have)**: Multi-tenancy + Auth
   - Add organization isolation
   - Implement Supabase Auth
   - Add RBAC checks

2. **Phase 2 (High-value)**: Customization
   - Email config per org
   - Branding/white-label
   - Custom email templates

3. **Phase 3 (Growth)**: Billing
   - Stripe integration
   - Subscription management
   - Usage tracking

4. **Phase 4 (Nice-to-have)**: Integrations
   - API keys
   - Webhooks
   - Third-party connectors

---

**Estimated Effort**: 
- Phase 1: 2-3 weeks (full-time dev)
- Phase 2: 1 week
- Phase 3: 1-2 weeks  
- Phase 4: 2-3 weeks per integration

**Cost Considerations**:
- Stripe fees: 2.9% + $0.30 per transaction
- Supabase: Scale as usage grows
- Email (SendGrid/Mailgun): $20-100/month base
- Infrastructure: AWS/Vercel for scaling
