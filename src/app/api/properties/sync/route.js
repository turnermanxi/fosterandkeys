/**
 * Property Sync Control API
 * Route: /api/properties/sync
 * 
 * Handles:
 * - POST /api/properties/sync - Trigger a sync batch
 * - GET /api/properties/sync/status/{jobId} - Get sync job status
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { runPropertySyncBatch, getSyncJobStatus } from '@/lib/propertySync.js';

/**
 * POST /api/properties/sync
 * Trigger a property sync batch
 */
export async function POST(req) {
  try {
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: () => cookies(),
      }
    );

    // Get user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get account
    const { data: account, error: accountError } = await supabaseClient
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { propertyIds, batchSize = 10 } = body;

    // Validate batch size
    if (batchSize < 1 || batchSize > 50) {
      return Response.json(
        { error: 'Batch size must be between 1-50' },
        { status: 400 }
      );
    }

    // Start sync job (don't wait for completion)
    const syncResult = await runPropertySyncBatch({
      supabaseClient,
      accountId: account.id,
      propertyIds,
      batchSize,
    });

    if (!syncResult.success) {
      return Response.json(
        { error: syncResult.error || 'Sync failed to start' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      jobId: syncResult.jobId,
      propertiesProcessed: syncResult.propertiesProcessed,
      stats: syncResult.stats,
      durationMs: syncResult.durationMs,
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return Response.json(
      { error: error.message || 'Failed to start sync' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/properties/sync/status/:jobId
 * Get status and results of a sync job
 */
export async function GET(req) {
  try {
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: () => cookies(),
      }
    );

    // Get user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get account
    const { data: account, error: accountError } = await supabaseClient
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Extract job ID from URL
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return Response.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const statusResult = await getSyncJobStatus({
      supabaseClient,
      accountId: account.id,
      jobId,
    });

    if (statusResult.error) {
      return Response.json(
        { error: statusResult.error },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      ...statusResult,
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
