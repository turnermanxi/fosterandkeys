/**
 * Netlify Function: Property Sync Cron Job
 * 
 * Scheduled via netlify.toml with @scheduled trigger
 * Runs automatically on a schedule to sync properties
 * 
 * In netlify.toml:
 * functions:
 *   - path: netlify/functions/sync-properties
 *     schedule: "0 2 * * *"  # Daily at 2 AM UTC
 */

import { runPropertySyncCronJob } from '../../src/lib/propertySyncCron.js';

export default async (req, context) => {
  try {
    const result = await runPropertySyncCronJob();

    return Response.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    console.error('Error in sync cron function:', error);

    return Response.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
      }
    );
  }
};

export const config = {
  schedule: '0 2 * * *', // Run daily at 2 AM UTC
};
