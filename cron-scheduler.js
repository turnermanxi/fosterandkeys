import cron from "node-cron";
import "dotenv/config";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

async function callEndpoint(path, method = "POST", body = null) {
  const url = `${BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (WEBHOOK_SECRET) headers["x-webhook-secret"] = WEBHOOK_SECRET;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();
  return { status: res.status, data };
}

// Email polling — every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Cron: Polling Gmail for new emails...`);
  try {
    const result = await callEndpoint("/api/cron/check-email");
    console.log(`[${new Date().toISOString()}] Email poll result:`, result.data);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Email poll error:`, err.message);
  }
});

// Property sync — daily at 2 AM UTC
cron.schedule("0 2 * * *", async () => {
  console.log(`[${new Date().toISOString()}] Cron: Running property sync...`);
  try {
    const result = await callEndpoint("/api/properties/sync", "POST");
    console.log(`[${new Date().toISOString()}] Property sync result:`, result.data);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Property sync error:`, err.message);
  }
}, { timezone: "UTC" });

// Auto-sync — daily at 3 AM UTC
cron.schedule("0 3 * * *", async () => {
  console.log(`[${new Date().toISOString()}] Cron: Running auto-sync...`);
  try {
    const accountsRes = await callEndpoint("/api/debug/account-status", "GET");
    const accounts = accountsRes.data?.accounts || [];
    for (const account of accounts) {
      const result = await callEndpoint(
        `/api/properties/auto-sync?accountId=${account.id}`,
        "GET"
      );
      console.log(`[${new Date().toISOString()}] Auto-sync account ${account.id}:`, result.data);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Auto-sync error:`, err.message);
  }
}, { timezone: "UTC" });

console.log(`[${new Date().toISOString()}] Cron scheduler started`);
console.log("  - Email polling: every 5 minutes");
console.log("  - Property sync: daily at 2 AM UTC");
console.log("  - Auto-sync: daily at 3 AM UTC");
console.log(`  - Target: ${BASE_URL}`);
