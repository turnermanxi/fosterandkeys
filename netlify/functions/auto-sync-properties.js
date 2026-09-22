// Netlify scheduled function for automatic property syncing
// Runs daily at 2 AM UTC

const handler = async (event) => {
  try {
    console.log("Starting automatic property sync at", new Date().toISOString());

    // Get all accounts from your app
    // Note: You'll need to import your Supabase client or use environment variables
    const response = await fetch(process.env.NEXT_PUBLIC_APP_URL + "/api/accounts");
    const accounts = await response.json();

    if (!accounts || accounts.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No accounts to sync" }),
      };
    }

    const results = [];

    // Sync each account
    for (const account of accounts) {
      try {
        const syncRes = await fetch(
          process.env.NEXT_PUBLIC_APP_URL +
            `/api/properties/auto-sync?accountId=${account.id}`,
          {
            headers: process.env.WEBHOOK_SECRET
              ? { "x-webhook-secret": process.env.WEBHOOK_SECRET }
              : {},
          }
        );
        const syncData = await syncRes.json();

        results.push({
          accountId: account.id,
          ...syncData,
        });

        console.log(`Synced account ${account.id}:`, syncData);
      } catch (err) {
        console.error(`Error syncing account ${account.id}:`, err);
        results.push({
          accountId: account.id,
          error: err.message,
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Auto-sync completed",
        results,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Auto-sync error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

export { handler };
