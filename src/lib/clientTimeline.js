const TIMELINE_LABELS = {
  lead_created: 'New lead added',
  call: 'Phone call',
  call_logged: 'Phone call logged',
  followup_scheduled: 'Follow-up scheduled',
  followup_completed: 'Follow-up completed',
  visit_started: 'Field visit started',
  visit_completed: 'Field visit completed',
  field_visit_assigned: 'Field visit assigned',
  sale: 'Sale recorded',
  note: 'Note added',
  profile_extras_added: 'Extra details added',
  profile_updated: 'Profile updated',
  profile_change_approved: 'Manager kept extras',
  profile_change_reverted: 'Manager reverted extras',
  stage_change: 'Stage changed',
};

export function timelineLabel(type) {
  if (!type) return 'Activity';
  return TIMELINE_LABELS[type] || String(type).replace(/_/g, ' ');
}

export function timelineStaff(event) {
  const details = event?.details;
  if (details && typeof details === 'object') {
    return details.staff || details.actor || details.manager || details.staff_name || '';
  }
  return event?.staff || '';
}

export function timelineSummary(event) {
  const details = event?.details;
  if (details == null || details === '') return 'No extra note.';
  if (typeof details === 'string') return details;
  const bits = [
    details.detail,
    details.details,
    details.note,
    details.notes,
    details.message,
    details.outcome ? `Outcome: ${String(details.outcome).replace(/_/g, ' ')}` : '',
    details.source ? `Source: ${String(details.source).replace(/_/g, ' ')}` : '',
    details.assigned_to ? `Assigned to ${details.assigned_to}` : '',
    details.weight_grams ? `${details.weight_grams}g` : '',
    details.amount ? `₹${details.amount}` : '',
  ].filter(Boolean);
  if (bits.length) return bits.join(' · ');
  try {
    return JSON.stringify(details);
  } catch {
    return 'Activity recorded.';
  }
}
