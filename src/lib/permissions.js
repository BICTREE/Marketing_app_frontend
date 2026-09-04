export const FLAG_LABELS = {
  can_view_leads: 'View leads',
  can_add_leads: 'Add leads',
  can_edit_leads: 'Edit leads',
  can_assign_leads: 'Assign leads',
  can_delete_leads: 'Delete leads',
  can_view_followups: 'View follow-ups',
  can_view_calls: 'View calls',
  can_add_calls: 'Log calls',
  can_view_staff: 'View team',
  can_add_staff: 'Add staff',
  can_edit_staff: 'Edit staff',
  can_delete_staff: 'Remove staff',
  can_view_attendance: 'View attendance',
  can_approve_attendance: 'Approve attendance',
  can_view_sales: 'View sales',
  can_add_sales: 'Record sales',
  can_view_reports: 'View reports',
  can_export_reports: 'Export reports',
  can_view_campaigns: 'View campaigns',
  can_create_campaigns: 'Create campaigns',
  can_view_field_visits: 'View field visits',
};

export const PERMISSION_GROUPS = [
  { group: 'Leads', hint: 'Who they can see and update in the lead book.', fields: ['can_view_leads', 'can_add_leads', 'can_edit_leads', 'can_assign_leads', 'can_delete_leads'] },
  { group: 'Follow-ups & Calls', hint: 'Call workbench and follow-up queue.', fields: ['can_view_followups', 'can_view_calls', 'can_add_calls'] },
  { group: 'Team', hint: 'Other staff in their branch.', fields: ['can_view_staff', 'can_add_staff', 'can_edit_staff', 'can_delete_staff'] },
  { group: 'Attendance', hint: 'Own punch is always available. These flags control the attendance module.', fields: ['can_view_attendance', 'can_approve_attendance'] },
  { group: 'Sales', hint: 'Gold sales they can see or record.', fields: ['can_view_sales', 'can_add_sales'] },
  { group: 'Reports & Campaigns', hint: 'Dashboards, WhatsApp campaigns, and exports.', fields: ['can_view_reports', 'can_export_reports', 'can_view_campaigns', 'can_create_campaigns'] },
  { group: 'Field visits', hint: 'Live map and visit assignment.', fields: ['can_view_field_visits'] },
];

const FLAG_FOR_CODE = {
  'leads:view': 'can_view_leads',
  'leads:create': 'can_add_leads',
  'leads:edit': 'can_edit_leads',
  'leads:assign': 'can_assign_leads',
  'leads:delete': 'can_delete_leads',
  'calls:view': 'can_view_calls',
  'calls:create': 'can_add_calls',
  'calls:execute': 'can_add_calls',
  'followups:view': 'can_view_followups',
  'sales:view': 'can_view_sales',
  'sales:create': 'can_add_sales',
  'attendance:view': 'can_view_attendance',
  'attendance:approve': 'can_approve_attendance',
  'attendance:manage': 'can_approve_attendance',
  'field_visits:view': 'can_view_field_visits',
  'field_visits:manage': 'can_view_field_visits',
  'staff:view': 'can_view_staff',
  'staff:create': 'can_add_staff',
  'staff:edit': 'can_edit_staff',
  'staff:delete': 'can_delete_staff',
  'reports:view': 'can_view_reports',
  'reports:export': 'can_export_reports',
  'campaigns:view': 'can_view_campaigns',
  'campaigns:create': 'can_create_campaigns',
  'campaigns:manage': 'can_create_campaigns',
};

export function permissionDeniedMessage(code) {
  const flag = FLAG_FOR_CODE[code];
  const label = (flag && FLAG_LABELS[flag]) || 'this section';
  return `You don't have access to ${label.toLowerCase()}. Ask your owner to enable it in Team → Security.`;
}

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  const nested = data?.error?.detail;
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  if (typeof nested === 'string' && nested.trim()) return nested;
  if (nested && typeof nested === 'object') {
    if (typeof nested.detail === 'string') return nested.detail;
    const first = Object.values(nested).flat?.()?.[0];
    if (typeof first === 'string') return first;
  }
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}

export { FLAG_FOR_CODE };
