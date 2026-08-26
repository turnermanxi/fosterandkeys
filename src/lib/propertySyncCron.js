/**
 * Property Sync Cron Job Runner
 * 
 * Automatically syncs properties on a schedule.
 * Can be triggered by:
 * - Netlify Functions (scheduled)
 * - AWS Lambda
 * - Traditional cron job
 * - Manual API call
 * 
 * Execution is backend-controlled with proper rate limiting and error handling.
 */

import { createClient } from '@supabase/supabase-js';
import { runPropertySyncBatch } from './propertySync.js';

/**
 * Initialize Supabase server client
 */
function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Get accounts that have sync enabled and are due for sync
 * 
 * @param {object} supabaseClient
 * @returns {Promise<array>} Accounts ready for sync
 */
async function getAccountsDueForSync(supabaseClient) {
  try {
    const { data: accounts, error } = await supabaseClient
      .from('property_sync_config')
      .select(
        `
        account_id,
        sync_enabled,
        sync_frequency,
        next_sync_at,
        accounts (
          id,
          user_id,
          email
        )
      `
      )
      .eq('sync_enabled', true)
      .lt('next_sync_at', new Date().toISOString())
      .or('next_sync_at.is.null');

    if (error) {
      throw error;
    }

    return accounts || [];
  } catch (error) {
    console.error('Error fetching accounts due for sync:', error);
    return [];
  }
}

/**
 * Calculate next sync time based on frequency
 * 
 * @param {string} frequency - 'daily', 'weekly', or custom interval
 * @returns {Date} Next sync time
 */
function getNextSyncTime(frequency) {
  const now = new Date();

  switch (frequency) {
    case 'daily':
      // Next day at 2 AM
      const nextDay = new Date(now);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(2, 0, 0, 0);
      return nextDay;

    case 'weekly':
      // Next week at same time
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;

    default:
      // Default to 24 hours
      const tomorrow = new Date(now);
      tomorrow.setHours(tomorrow.getHours() + 24);
      return tomorrow;
  }
}

/**
 * Update sync config with new sync time
 * 
 * @param {object} supabaseClient
 * @param {string} accountId
 * @param {Date} nextSyncTime
 */
async function updateNextSyncTime(supabaseClient, accountId, nextSyncTime) {
  try {
    const { error } = await supabaseClient
      .from('property_sync_config')
      .update({
        last_sync_at: new Date().toISOString(),
        next_sync_at: nextSyncTime.toISOString(),
      })
      .eq('account_id', accountId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(`Error updating sync time for account ${accountId}:`, error);
  }
}

/**
 * Process sync queue items (retry failed syncs)
 * 
 * @param {object} supabaseClient
 * @param {string} accountId
 */
async function processSyncQueue(supabaseClient, accountId) {
  try {
    // Get pending items
    const { data: queueItems, error } = await supabaseClient
      .from('property_sync_queue')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'pending')
      .lt('attempt_count', 3)
      .order('priority', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    if (!queueItems || queueItems.length === 0) {
      return { processed: 0 };
    }

    // Process each queued item
    const results = [];
    for (const item of queueItems) {
      try {
        // Update status to processing
        await supabaseClient
          .from('property_sync_queue')
          .update({
            status: 'processing',
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // Get property details
        const { data: property, error: propError } = await supabaseClient
          .from('properties')
          .select('*')
          .eq('id', item.property_id)
          .single();

        if (propError || !property) {
          throw new Error('Property not found');
        }

        // Try to sync the property
        // (Using the syncResult from main pipeline)
        const { runPropertySyncBatch } = await import('./propertySync.js');

        const syncResult = await runPropertySyncBatch({
          supabaseClient,
          accountId,
          propertyIds: [item.property_id],
          batchSize: 1,
        });

        if (syncResult.success && syncResult.stats.successful > 0) {
          // Mark as completed
          await supabaseClient
            .from('property_sync_queue')
            .update({
              status: 'completed',
              attempt_count: item.attempt_count + 1,
            })
            .eq('id', item.id);

          results.push({ id: item.id, success: true });
        } else {
          throw new Error('Sync failed');
        }
      } catch (error) {
        console.error(`Error processing queue item ${item.id}:`, error);

        // Increment attempt count
        const newAttemptCount = item.attempt_count + 1;
        const status = newAttemptCount >= 3 ? 'failed' : 'pending';

        await supabaseClient
          .from('property_sync_queue')
          .update({
            status,
            attempt_count: newAttemptCount,
            error_message: error.message,
          })
          .eq('id', item.id);

        results.push({ id: item.id, success: false, error: error.message });
      }
    }

    return { processed: results.length, results };
  } catch (error) {
    console.error(`Error processing sync queue for account ${accountId}:`, error);
    return { processed: 0, error: error.message };
  }
}

/**
 * Run sync for a single account
 * 
 * @param {object} supabaseClient
 * @param {object} account
 * @returns {Promise<object>} Sync result
 */
async function syncAccount(supabaseClient, account) {
  const accountId = account.account_id;
  const startTime = Date.now();

  try {
    console.log(`Starting sync for account ${accountId}...`);

    // Process retry queue first
    const queueResult = await processSyncQueue(supabaseClient, accountId);
    console.log(`Processed ${queueResult.processed} queued items`);

    // Get sync config
    const { data: config } = await supabaseClient
      .from('property_sync_config')
      .select('batch_size, sync_frequency')
      .eq('account_id', accountId)
      .single();

    const batchSize = config?.batch_size || 10;
    const frequency = config?.sync_frequency || 'daily';

    // Run full sync batch
    const syncResult = await runPropertySyncBatch({
      supabaseClient,
      accountId,
      batchSize,
    });

    // Update sync config with next sync time
    if (syncResult.success) {
      const nextSyncTime = getNextSyncTime(frequency);
      await updateNextSyncTime(supabaseClient, accountId, nextSyncTime);
    }

    const duration = Date.now() - startTime;

    console.log(
      `Sync completed for account ${accountId} in ${duration}ms:`,
      syncResult.stats
    );

    return {
      accountId,
      success: syncResult.success,
      jobId: syncResult.jobId,
      stats: syncResult.stats,
      durationMs: duration,
      error: syncResult.error,
    };
  } catch (error) {
    console.error(`Error syncing account ${accountId}:`, error);
    return {
      accountId,
      success: false,
      error: error.message,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Main cron job handler
 * Can be called from Netlify Functions, Lambda, or direct cron
 * 
 * @param {object} event - Optional event from serverless framework
 * @returns {Promise<object>} Job result
 */
export async function runPropertySyncCronJob(event = {}) {
  const jobStartTime = Date.now();

  try {
    console.log('='.repeat(60));
    console.log('Property Sync Cron Job Started');
    console.log('Time:', new Date().toISOString());
    console.log('='.repeat(60));

    const supabaseClient = createSupabaseClient();

    // Get accounts due for sync
    const accountsDueForSync = await getAccountsDueForSync(supabaseClient);

    console.log(`Found ${accountsDueForSync.length} accounts due for sync`);

    if (accountsDueForSync.length === 0) {
      return {
        success: true,
        message: 'No accounts due for sync',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - jobStartTime,
      };
    }

    // Process each account
    const results = [];
    for (const account of accountsDueForSync) {
      const result = await syncAccount(supabaseClient, account);
      results.push(result);

      // Rate limiting between accounts
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Summary
    const successCount = results.filter((r) => r.success).length;
    const totalDuration = Date.now() - jobStartTime;

    const summary = {
      success: true,
      totalAccounts: accountsDueForSync.length,
      successfulSyncs: successCount,
      failedSyncs: results.length - successCount,
      results,
      totalDurationMs: totalDuration,
      timestamp: new Date().toISOString(),
    };

    console.log('='.repeat(60));
    console.log('Sync Cron Job Completed');
    console.log('Summary:', summary);
    console.log('='.repeat(60));

    return summary;
  } catch (error) {
    console.error('Fatal error in sync cron job:', error);

    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - jobStartTime,
    };
  }
}

/**
 * Handler for Netlify Functions
 * Automatically called on schedule
 */
export async function handler(event, context) {
  const result = await runPropertySyncCronJob(event);
  return {
    statusCode: result.success ? 200 : 500,
    body: JSON.stringify(result),
  };
}

// If running as standalone script (for traditional cron)
if (import.meta.url === `file://${process.argv[1]}`) {
  runPropertySyncCronJob().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
