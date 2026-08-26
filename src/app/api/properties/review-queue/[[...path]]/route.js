/**
 * Property Review Queue & Sync API
 * Route: /api/properties/review-queue
 * 
 * Handles:
 * - GET /api/properties/review-queue - Get pending reviews
 * - POST /api/properties/review-queue/{id}/approve - Approve an update
 * - POST /api/properties/review-queue/{id}/reject - Reject an update
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  getReviewQueue,
  approveReviewQueueItem,
  rejectReviewQueueItem,
} from '@/lib/propertyUpdater.js';

/**
 * GET /api/properties/review-queue
 * Get pending review queue items
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

    // Get URL params
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const reviewQueue = await getReviewQueue({
      supabaseClient,
      accountId: account.id,
      status,
      limit,
    });

    return Response.json({
      success: true,
      count: reviewQueue.length,
      items: reviewQueue,
    });
  } catch (error) {
    console.error('Error fetching review queue:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch review queue' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/properties/review-queue/{id}/approve
 * Approve and apply a review queue update
 */
export async function POST(req) {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const action = pathParts[pathParts.length - 1]; // 'approve' or 'reject'
    const reviewQueueId = pathParts[pathParts.length - 2];

    if (!reviewQueueId) {
      return Response.json(
        { error: 'Review queue ID required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return Response.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

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

    const body = await req.json();
    const { notes } = body;

    let result;
    if (action === 'approve') {
      result = await approveReviewQueueItem({
        supabaseClient,
        accountId: account.id,
        reviewQueueId,
        approvedBy: user.id,
        notes,
      });
    } else {
      result = await rejectReviewQueueItem({
        supabaseClient,
        accountId: account.id,
        reviewQueueId,
        rejectedBy: user.id,
        notes,
      });
    }

    if (!result.success) {
      return Response.json(
        { error: result.error || 'Operation failed' },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      action: result.action,
      propertyId: result.propertyId,
    });
  } catch (error) {
    console.error('Error processing review action:', error);
    return Response.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
