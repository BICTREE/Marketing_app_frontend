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

export function pipelinePurpose(item = {}) {
  if (item.kind === 'visit' || item.followup_type === 'visit') return 'Field visit';
  if (item.followup_type === 'whatsapp') return 'WhatsApp follow-up';
  if (item.followup_type === 'email') return 'Email';
  if (item.followup_type === 'sms') return 'SMS';
  return 'Phone call';
}

export function followupDueLabel(scheduledDate) {
  if (!scheduledDate) return '';
  const ms = new Date(scheduledDate).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  const mins = Math.round(ms / 60000);
  if (mins <= -1440) {
    const days = Math.floor(Math.abs(mins) / 1440);
    return `overdue by ${days} day${days === 1 ? '' : 's'}`;
  }
  if (mins <= -60) {
    const hours = Math.floor(Math.abs(mins) / 60);
    return `overdue by ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  if (mins < 0) return `overdue by ${Math.abs(mins)} min`;
  if (mins === 0) return 'due now';
  if (mins < 60) return `in ${mins} min`;
  if (mins < 1440) {
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (rem && hours < 6) return `in ${hours} hr ${rem} min`;
    return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.round(mins / 1440);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}
