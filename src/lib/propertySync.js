/**
 * Property Sync Pipeline Orchestrator
 * 
 * Coordinates the entire automated refresh process:
 * 1. Fetch HTML from source URLs
 * 2. Extract property data using OpenAI
 * 3. Compare with existing data
 * 4. Apply updates, create review queue, or ignore
 * 5. Track sync job status and metrics
 * 
 * This is NOT an autonomous agent. Backend controls all logic.
 */

import { extractPropertyDataFromHTML } from './propertyExtractor.js';
import { comparePropertyData, buildUpdateObject } from './propertyComparator.js';
import { processSyncResult } from './propertyUpdater.js';

/**
 * Fetch HTML content from a URL
 * 
 * @param {string} url - URL to fetch
 * @param {number} timeoutMs - Request timeout
 * @returns {Promise<{success: boolean, html?: string, error?: string}>}
 */
async function fetchPropertyHTML(url, timeoutMs = 30000) {
  try {
    if (!url) {
      return { success: false, error: 'No URL provided' };
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return { success: false, error: 'Invalid URL format' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Foster-and-Keys-Property-Sync/1.0',
        Accept: 'text/html',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();

    if (!html || html.length < 100) {
      return { success: false, error: 'Response too small or empty' };
    }

    return { success: true, html };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown fetch error',
    };
  }
}

/**
 * Process a single property through the full sync pipeline
 * 
 * @param {object} params
 * @returns {Promise<object>} Pipeline result
 */
export async function processPropertySync({
  supabaseClient,
  accountId,
  property,
  syncJobId = null,
  syncConfig = {},
}) {
  const startTime = Date.now();
  const result = {
    propertyId: property.id,
    success: false,
    steps: {
      fetch: null,
      extract: null,
      compare: null,
      update: null,
    },
    durationMs: 0,
  };

  try {
    // Step 1: Fetch HTML
    result.steps.fetch = { status: 'pending' };

    const fetchResult = await fetchPropertyHTML(property.source_url);
    if (!fetchResult.success) {
      result.steps.fetch = {
        status: 'failed',
        error: fetchResult.error,
      };

      // Log failure
      await supabaseClient.from('property_sync_logs').insert({
        account_id: accountId,
        property_id: property.id,
        sync_job_id: syncJobId,
        source_url: property.source_url,
        fetch_error: fetchResult.error,
        action_taken: 'error',
        synced_at: new Date().toISOString(),
      });

      result.durationMs = Date.now() - startTime;
      return result;
    }

    result.steps.fetch = {
      status: 'success',
      bytesReceived: fetchResult.html?.length,
    };

    // Step 2: Extract data from HTML
    result.steps.extract = { status: 'pending' };

    const extractResult = await extractPropertyDataFromHTML(
      fetchResult.html,
      property.source_url,
      property
    );

    if (!extractResult.success) {
      result.steps.extract = {
        status: 'failed',
        error: extractResult.error,
      };

      // Log extraction error
      await supabaseClient.from('property_sync_logs').insert({
        account_id: accountId,
        property_id: property.id,
        sync_job_id: syncJobId,
        source_url: property.source_url,
        fetched_html: fetchResult.html?.substring(0, 5000),
        extraction_error: extractResult.error,
        action_taken: 'error',
        synced_at: new Date().toISOString(),
      });

      result.durationMs = Date.now() - startTime;
      return result;
    }

    result.steps.extract = {
      status: 'success',
      fieldsExtracted: Object.keys(extractResult.data).filter(
        (k) => extractResult.data[k] !== null
      ).length,
    };

    // Step 3: Compare with existing data
    result.steps.compare = { status: 'pending' };

    const comparisonConfig = {
      priceChangeThreshold: syncConfig.price_change_threshold_percent
        ? syncConfig.price_change_threshold_percent / 100
        : 0.2,
      maxNullThreshold: syncConfig.max_null_threshold || 0.3,
    };

    const comparison = comparePropertyData(
      extractResult.data,
      property,
      comparisonConfig
    );

    result.steps.compare = {
      status: 'success',
      changedFields: comparison.changedFields.length,
      needsReview: comparison.needs_review,
      reasons: comparison.reasons,
    };

    // Step 4: Process the result (update, ignore, or queue for review)
    result.steps.update = { status: 'pending' };

    const updateResult = await processSyncResult({
      supabaseClient,
      accountId,
      propertyId: property.id,
      extracted: extractResult.data,
      existing: property,
      comparison,
      htmlContent: fetchResult.html,
      sourceUrl: property.source_url,
      syncJobId,
    });

    result.steps.update = {
      status: updateResult.success ? 'success' : 'failed',
      action: updateResult.action,
      error: updateResult.error,
    };

    result.success = updateResult.success;
    result.action = updateResult.action;
    result.durationMs = Date.now() - startTime;

    return result;
  } catch (error) {
    console.error(`Error processing property ${property.id}:`, error);
    result.steps.update = {
      status: 'failed',
      error: error.message,
    };
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

/**
 * Run a full sync batch for an account
 * 
 * @param {object} params
 * @returns {Promise<object>} Sync job result with metrics
 */
export async function runPropertySyncBatch({
  supabaseClient,
  accountId,
  propertyIds = null,
  batchSize = 10,
  excludeFailures = true,
}) {
  const startTime = Date.now();

  // Create sync job record
  const { data: jobData, error: jobError } = await supabaseClient
    .from('property_sync_jobs')
    .insert({
      account_id: accountId,
      started_at: new Date().toISOString(),
      status: 'in_progress',
    })
    .select('id')
    .single();

  if (jobError) {
    console.error('Failed to create sync job:', jobError);
    return {
      success: false,
      error: 'Failed to create sync job',
    };
  }

  const syncJobId = jobData.id;

  try {
    // Get sync config
    const { data: configData } = await supabaseClient
      .from('property_sync_config')
      .select('*')
      .eq('account_id', accountId)
      .single();

    const syncConfig = configData || {};

    // Fetch properties to sync
    let query = supabaseClient
      .from('properties')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .not('source_url', 'is', null);

    if (propertyIds) {
      query = query.in('id', propertyIds);
    }

    const { data: properties, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch properties: ${fetchError.message}`);
    }

    if (!properties || properties.length === 0) {
      // Update job to completed
      await supabaseClient
        .from('property_sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_properties: 0,
        })
        .eq('id', syncJobId);

      return {
        success: true,
        jobId: syncJobId,
        propertiesProcessed: 0,
        stats: {
          total: 0,
          successful: 0,
          failed: 0,
          updated: 0,
          reviewed: 0,
          ignored: 0,
        },
      };
    }

    // Process in batches
    const results = [];
    const stats = {
      total: properties.length,
      successful: 0,
      failed: 0,
      updated: 0,
      reviewed: 0,
      ignored: 0,
    };

    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);

      // Process batch in parallel with rate limiting
      const batchResults = await Promise.all(
        batch.map((property, index) =>
          new Promise((resolve) => {
            // Stagger requests to avoid rate limiting
            setTimeout(async () => {
              const result = await processPropertySync({
                supabaseClient,
                accountId,
                property,
                syncJobId,
                syncConfig,
              });
              resolve(result);
            }, index * 500); // 500ms between requests in batch
          })
        )
      );

      results.push(...batchResults);

      // Update stats
      batchResults.forEach((result) => {
        if (result.success) {
          stats.successful++;
        } else {
          stats.failed++;
        }

        if (result.action === 'updated') {
          stats.updated++;
        } else if (result.action === 'review_pending') {
          stats.reviewed++;
        } else if (result.action === 'ignored') {
          stats.ignored++;
        }
      });

      // Log progress
      console.log(
        `Processed ${Math.min(i + batchSize, properties.length)}/${properties.length} properties`
      );
    }

    // Update sync job with final status
    const { error: updateError } = await supabaseClient
      .from('property_sync_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_properties: stats.total,
        processed_count: results.length,
        updated_count: stats.updated,
        review_count: stats.reviewed,
        failed_count: stats.failed,
      })
      .eq('id', syncJobId);

    if (updateError) {
      console.error('Error updating sync job:', updateError);
    }

    return {
      success: true,
      jobId: syncJobId,
      propertiesProcessed: results.length,
      durationMs: Date.now() - startTime,
      stats,
      results,
    };
  } catch (error) {
    console.error('Error in sync batch:', error);

    // Mark job as failed
    await supabaseClient
      .from('property_sync_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message,
      })
      .eq('id', syncJobId);

    return {
      success: false,
      jobId: syncJobId,
      error: error.message,
    };
  }
}

/**
 * Get sync job status and results
 * 
 * @param {object} params
 * @returns {Promise<object>} Job details
 */
export async function getSyncJobStatus({
  supabaseClient,
  accountId,
  jobId,
}) {
  try {
    // Get job details
    const { data: job, error: jobError } = await supabaseClient
      .from('property_sync_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('account_id', accountId)
      .single();

    if (jobError) {
      throw jobError;
    }

    // Get associated logs
    const { data: logs, error: logsError } = await supabaseClient
      .from('property_sync_logs')
      .select(
        `
        id,
        property_id,
        action_taken,
        needs_review,
        synced_at,
        review_reason
      `
      )
      .eq('sync_job_id', jobId)
      .order('synced_at', { ascending: false });

    if (logsError) {
      console.error('Error fetching logs:', logsError);
    }

    return {
      jobId,
      job,
      logs: logs || [],
      summary: {
        duration:
          job.completed_at && job.started_at
            ? new Date(job.completed_at) - new Date(job.started_at)
            : null,
        completionPercentage:
          job.processed_count > 0
            ? ((job.processed_count / job.total_properties) * 100).toFixed(1)
            : 0,
      },
    };
  } catch (error) {
    console.error('Error getting sync job status:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
