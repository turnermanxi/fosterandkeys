import { getSupabaseAdmin } from './supabase';

/**
 * Pipeline Status Stages
 */
export const PIPELINE_STAGES = {
  CREATED: 'created',
  RECOMMENDED_SENT: 'recommended_sent',
  CX_RESPONDED: 'cx_responded',
  TOUR_SCHEDULED: 'tour_scheduled',
  TOUR_CONFIRMATION_SENT: 'tour_confirmation_sent',
  TOUR_COMPLETED: 'tour_completed',
  APPLICATION_PENDING: 'application_pending',
  APPLICATION_SUBMITTED: 'application_submitted',
  APPROVED: 'approved',
  DENIED: 'denied',
  COMMISSION_CONFIRMED: 'commission_confirmed',
};

/**
 * Add a timeline event to a lead
 * @param {string} leadId - Lead UUID
 * @param {string} stage - Pipeline stage from PIPELINE_STAGES
 * @param {object} options - { notes, data, visibility }
 * @returns {Promise<object>} Updated lead
 */
export async function addTimelineEvent(leadId, stage, options = {}) {
  const { notes = '', data = {}, visibility = 'both' } = options;
  const supabase = getSupabaseAdmin();

  // Get current timeline
  const { data: lead, error: fetchErr } = await supabase
    .from('leads')
    .select('timeline, current_status')
    .eq('id', leadId)
    .single();

  if (fetchErr) throw fetchErr;

  // Create new event
  const newEvent = {
    stage,
    timestamp: new Date().toISOString(),
    notes,
    data,
    visibility, // 'agent_only' | 'cx_only' | 'both'
  };

  // Append to timeline
  const updatedTimeline = [...(lead.timeline || []), newEvent];

  // Update lead with new timeline and current_status
  const { data: updated, error: updateErr } = await supabase
    .from('leads')
    .update({
      timeline: updatedTimeline,
      current_status: stage,
    })
    .eq('id', leadId)
    .select()
    .single();

  if (updateErr) throw updateErr;
  return updated;
}

/**
 * Set recommended units for a lead
 * @param {string} leadId - Lead UUID
 * @param {array} units - Array of {unit_id, apartment_id, score}
 * @returns {Promise<object>} Updated lead
 */
export async function setRecommendedUnits(leadId, units) {
  const supabase = getSupabaseAdmin();

  const recommendedUnits = units.map((u) => ({
    unit_id: u.unit_id || u.id,
    apartment_id: u.apartment_id,
    score: u.score,
    sent_at: new Date().toISOString(),
    cx_response: null, // Will be filled when CX responds
  }));

  const { data, error } = await supabase
    .from('leads')
    .update({ recommended_units: recommendedUnits })
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update CX response to recommended units
 * @param {string} leadId - Lead UUID
 * @param {array} preferences - [{unit_id, response: 'interested|not_interested'}, ...]
 * @returns {Promise<object>} Updated lead
 */
export async function updateCxPreferences(leadId, preferences) {
  const supabase = getSupabaseAdmin();

  const { data: lead, error: fetchErr } = await supabase
    .from('leads')
    .select('recommended_units')
    .eq('id', leadId)
    .single();

  if (fetchErr) throw fetchErr;

  // Update CX responses
  const updated = lead.recommended_units.map((rec) => {
    const pref = preferences.find((p) => p.unit_id === rec.unit_id);
    return pref ? { ...rec, cx_response: pref.response } : rec;
  });

  const { data, error } = await supabase
    .from('leads')
    .update({ 
      recommended_units: updated,
      cx_feedback: preferences.notes || null,
    })
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Set tour details for a lead
 * @param {string} leadId - Lead UUID
 * @param {object} tourInfo - {date, time, apartment_id, location_notes}
 * @returns {Promise<object>} Updated lead
 */
export async function setTourDetails(leadId, tourInfo) {
  const supabase = getSupabaseAdmin();

  const tourDetails = {
    date: tourInfo.date,
    time: tourInfo.time,
    apartment_id: tourInfo.apartment_id,
    location_notes: tourInfo.location_notes || null,
    scheduled_at: new Date().toISOString(),
    confirmation_sent_at: null,
  };

  const { data, error } = await supabase
    .from('leads')
    .update({ tour_details: tourDetails })
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Send tour confirmation
 * @param {string} leadId - Lead UUID
 * @param {string} confirmationNotes - What to include in email
 * @returns {Promise<object>} Updated lead
 */
export async function sendTourConfirmation(leadId, confirmationNotes) {
  const supabase = getSupabaseAdmin();

  const { data: lead, error: fetchErr } = await supabase
    .from('leads')
    .select('tour_details')
    .eq('id', leadId)
    .single();

  if (fetchErr) throw fetchErr;

  const updatedTourDetails = {
    ...lead.tour_details,
    confirmation_sent_at: new Date().toISOString(),
    confirmation_notes: confirmationNotes,
  };

  const { data, error } = await supabase
    .from('leads')
    .update({ 
      tour_details: updatedTourDetails,
    })
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update application status
 * @param {string} leadId - Lead UUID
 * @param {object} status - {applied_at, decision, decision_at, denial_reason}
 * @returns {Promise<object>} Updated lead
 */
export async function updateApplicationStatus(leadId, status) {
  const supabase = getSupabaseAdmin();

  const applicationStatus = {
    status: status.decision ? (status.decision === 'approved' ? 'approved' : 'denied') : 'submitted',
    applied_at: status.applied_at || null,
    decision: status.decision || null,
    decision_at: status.decision_at || null,
    denial_reason: status.denial_reason || null,
  };

  const { data, error } = await supabase
    .from('leads')
    .update({ application_status: applicationStatus })
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Flag a lead for follow-up
 * @param {string} leadId - Lead UUID
 * @param {Date} remindAt - When to remind
 * @param {string} reason - Why follow-up is needed
 * @returns {Promise<object>} Updated lead
 */
export async function flagFollowUp(leadId, remindAt, reason) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('leads')
    .update({
      follow_up_needed: true,
      follow_up_reminder_at: remindAt.toISOString(),
    })
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw error;

  // Add to timeline
  await addTimelineEvent(leadId, PIPELINE_STAGES.CREATED, {
    notes: `Follow-up flagged: ${reason}`,
    visibility: 'agent_only',
  });

  return data;
}

/**
 * Confirm commission with apartment complex
 * @param {string} leadId - Lead UUID
 * @returns {Promise<object>} Updated lead
 */
export async function confirmCommission(leadId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('leads')
    .update({
      commission_confirmed: true,
      commission_confirmed_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw error;

  // Add to timeline
  await addTimelineEvent(leadId, PIPELINE_STAGES.COMMISSION_CONFIRMED, {
    notes: 'Commission confirmed with apartment complex',
    visibility: 'agent_only',
  });

  return data;
}

/**
 * Get full lead with timeline (for timeline detail view)
 * @param {string} leadId - Lead UUID
 * @returns {Promise<object>} Full lead object
 */
export async function getLeadWithTimeline(leadId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Filter timeline events for CX view (only 'both' and 'cx_only' visibility)
 * @param {array} timeline - Full timeline array
 * @returns {array} Filtered timeline
 */
export function formatTimelineForCx(timeline) {
  return (timeline || []).filter(
    (event) => event.visibility === 'both' || event.visibility === 'cx_only'
  );
}

/**
 * Format timeline for agent view (all events)
 * @param {array} timeline - Full timeline array
 * @returns {array} Timeline for agent
 */
export function formatTimelineForAgent(timeline) {
  return timeline || [];
}

/**
 * Get leads pending follow-up
 * @returns {Promise<array>} Leads needing follow-up
 */
export async function getLeadsPendingFollowUp() {
  const supabase = getSupabaseAdmin();

  const now = new Date();

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('follow_up_needed', true)
    .lte('follow_up_reminder_at', now.toISOString());

  if (error) throw error;
  return data || [];
}
