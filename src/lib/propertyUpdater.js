/**
 * Property Updater
 * 
 * Handles applying updates to properties, creating logs, and managing review queue.
 * All database writes are tracked for audit trails.
 */

import { createServerClient } from '@supabase/ssr';

/**
 * Process a single property sync result
 * Decides whether to update, ignore, or mark for review
 * 
 * @param {object} params - Processing parameters
 * @returns {Promise<object>} Processing result
 */
export async function processSyncResult({
  supabaseClient,
  accountId,
  propertyId,
  extracted,
  existing,
  comparison,
  htmlContent,
  sourceUrl,
  syncJobId = null,
}) {
  try {
    const now = new Date().toISOString();

    // Prepare sync log entry
    const syncLogEntry = {
      account_id: accountId,
      property_id: propertyId,
      sync_job_id: syncJobId,
      source_url: sourceUrl,
      fetched_html: htmlContent ? htmlContent.substring(0, 5000) : null,
      extracted_data: extracted,
      diff_result: comparison.diff,
      needs_review: comparison.needs_review,
      review_reason: comparison.reasons.join(' | '),
      synced_at: now,
    };

    let action = 'ignored';
    let changesApplied = null;

    // Determine action based on comparison
    if (!comparison.should_update) {
      // No changes, log and ignore
      syncLogEntry.action_taken = 'ignored';
      action = 'ignored';
    } else if (comparison.needs_review) {
      // Needs manual review - create review queue entry
      action = 'review_pending';
      syncLogEntry.action_taken = 'review_pending';

      const buildUpdateObject = (diff, allowNull = false) => {
        const update = {};
        diff.forEach((change) => {
          if (change.new_value !== null || allowNull) {
            update[change.field] = change.new_value;
          }
        });
        return update;
      };

      const proposedUpdate = buildUpdateObject(comparison.diff, false);

      // Create review queue entry
      const { data: reviewEntry, error: reviewError } = await supabaseClient
        .from('property_review_queue')
        .insert({
          account_id: accountId,
          property_id: propertyId,
          proposed_changes: proposedUpdate,
          diff: {
            changes: comparison.diff,
            summary: comparison.reasons,
          },
          review_status: 'pending',
          created_at: now,
        });

      if (reviewError) {
        console.error('Error creating review queue entry:', reviewError);
        syncLogEntry.action_taken = 'error';
        syncLogEntry.fetch_error = reviewError.message;
        action = 'error';
      }
    } else if (comparison.should_update && !comparison.needs_review) {
      // Safe to auto-update
      action = 'updated';
      syncLogEntry.action_taken = 'updated';

      const buildUpdateObject = (diff, allowNull = false) => {
        const update = {};
        diff.forEach((change) => {
          if (change.new_value !== null || allowNull) {
            update[change.field] = change.new_value;
          }
        });
        return update;
      };

      changesApplied = buildUpdateObject(comparison.diff, false);
      changesApplied.updated_at = now;

      // Apply update to properties table
      const { error: updateError } = await supabaseClient
        .from('properties')
        .update(changesApplied)
        .eq('id', propertyId)
        .eq('account_id', accountId);

      if (updateError) {
        console.error('Error updating property:', updateError);
        syncLogEntry.action_taken = 'error';
        syncLogEntry.fetch_error = updateError.message;
        changesApplied = null;
        action = 'error';
      } else {
        syncLogEntry.changes_applied = changesApplied;
      }
    }

    // Write sync log
    const { error: logError } = await supabaseClient
      .from('property_sync_logs')
      .insert(syncLogEntry);

    if (logError) {
      console.error('Error writing sync log:', logError);
    }

    return {
      success: action !== 'error',
      action,
      propertyId,
      changesApplied,
      comparison,
    };
  } catch (error) {
    console.error('Error processing sync result:', error);
    return {
      success: false,
      action: 'error',
      propertyId,
      error: error.message,
    };
  }
}

/**
 * Approve a review queue item and apply the changes
 * 
 * @param {object} params
 * @returns {Promise<object>} Update result
 */
export async function approveReviewQueueItem({
  supabaseClient,
  accountId,
  reviewQueueId,
  approvedBy,
  notes = null,
}) {
  try {
    // Get review queue item
    const { data: reviewItem, error: fetchError } = await supabaseClient
      .from('property_review_queue')
      .select('*')
      .eq('id', reviewQueueId)
      .eq('account_id', accountId)
      .single();

    if (fetchError) {
      throw new Error(`Review item not found: ${fetchError.message}`);
    }

    const now = new Date().toISOString();

    // Apply the proposed changes
    const { error: updateError } = await supabaseClient
      .from('properties')
      .update({
        ...reviewItem.proposed_changes,
        updated_at: now,
      })
      .eq('id', reviewItem.property_id)
      .eq('account_id', accountId);

    if (updateError) {
      throw new Error(`Failed to apply changes: ${updateError.message}`);
    }

    // Mark review queue item as approved
    const { error: reviewUpdateError } = await supabaseClient
      .from('property_review_queue')
      .update({
        review_status: 'approved',
        reviewed_by: approvedBy,
        reviewed_at: now,
        review_notes: notes,
      })
      .eq('id', reviewQueueId)
      .eq('account_id', accountId);

    if (reviewUpdateError) {
      throw new Error(`Failed to update review status: ${reviewUpdateError.message}`);
    }

    // Log the approval in sync logs
    const { data: syncLog } = await supabaseClient
      .from('property_sync_logs')
      .select('id')
      .eq('property_id', reviewItem.property_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (syncLog) {
      await supabaseClient
        .from('property_sync_logs')
        .update({
          action_taken: 'updated',
          changes_applied: reviewItem.proposed_changes,
        })
        .eq('id', syncLog.id);
    }

    return {
      success: true,
      action: 'approved',
      propertyId: reviewItem.property_id,
      changesApplied: reviewItem.proposed_changes,
    };
  } catch (error) {
    console.error('Error approving review item:', error);
    return {
      success: false,
      action: 'error',
      error: error.message,
    };
  }
}

/**
 * Reject a review queue item (discard changes)
 * 
 * @param {object} params
 * @returns {Promise<object>} Result
 */
export async function rejectReviewQueueItem({
  supabaseClient,
  accountId,
  reviewQueueId,
  rejectedBy,
  notes = null,
}) {
  try {
    // Get review item
    const { data: reviewItem, error: fetchError } = await supabaseClient
      .from('property_review_queue')
      .select('*')
      .eq('id', reviewQueueId)
      .eq('account_id', accountId)
      .single();

    if (fetchError) {
      throw new Error(`Review item not found: ${fetchError.message}`);
    }

    const now = new Date().toISOString();

    // Mark review queue item as rejected
    const { error: reviewUpdateError } = await supabaseClient
      .from('property_review_queue')
      .update({
        review_status: 'rejected',
        reviewed_by: rejectedBy,
        reviewed_at: now,
        review_notes: notes,
      })
      .eq('id', reviewQueueId)
      .eq('account_id', accountId);

    if (reviewUpdateError) {
      throw new Error(`Failed to update review status: ${reviewUpdateError.message}`);
    }

    return {
      success: true,
      action: 'rejected',
      propertyId: reviewItem.property_id,
    };
  } catch (error) {
    console.error('Error rejecting review item:', error);
    return {
      success: false,
      action: 'error',
      error: error.message,
    };
  }
}

/**
 * Get review queue for an account
 * 
 * @param {object} params
 * @returns {Promise<array>} Review queue items
 */
export async function getReviewQueue({
  supabaseClient,
  accountId,
  status = 'pending',
  limit = 50,
}) {
  try {
    const query = supabaseClient
      .from('property_review_queue')
      .select(
        `
        id,
        property_id,
        proposed_changes,
        diff,
        review_status,
        review_notes,
        created_at,
        properties (
          id,
          property_name,
          address,
          city,
          price_min,
          price_max
        )
      `
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (status) {
      query.eq('review_status', status);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching review queue:', error);
    return [];
  }
}

/**
 * Manually add a property to review queue (for edge cases)
 * 
 * @param {object} params
 * @returns {Promise<object>} Result
 */
export async function addToReviewQueue({
  supabaseClient,
  accountId,
  propertyId,
  proposedChanges,
  reason,
}) {
  try {
    const { data, error } = await supabaseClient
      .from('property_review_queue')
      .insert({
        account_id: accountId,
        property_id: propertyId,
        proposed_changes: proposedChanges,
        diff: {
          reason: reason,
          manuallyAdded: true,
        },
        review_status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id');

    if (error) {
      throw error;
    }

    return {
      success: true,
      reviewQueueId: data[0]?.id,
    };
  } catch (error) {
    console.error('Error adding to review queue:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Clean up expired review queue items (older than 7 days)
 * 
 * @param {object} supabaseClient
 * @param {string} accountId
 * @returns {Promise<object>} Cleanup result
 */
export async function cleanupExpiredReviews(supabaseClient, accountId) {
  try {
    const { data, error } = await supabaseClient
      .from('property_review_queue')
      .delete()
      .eq('account_id', accountId)
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      throw error;
    }

    return {
      success: true,
      deletedCount: data?.length || 0,
    };
  } catch (error) {
    console.error('Error cleaning up expired reviews:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
