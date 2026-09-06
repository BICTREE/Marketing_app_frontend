export const JEWELLERY_OCCASIONS = [
  { value: 'daughter_marriage', label: "Daughter's marriage" },
  { value: 'son_marriage', label: "Son's marriage" },
  { value: 'own_marriage', label: 'Own marriage' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'anniversary', label: 'Wedding anniversary' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'housewarming', label: 'Housewarming' },
  { value: 'baby', label: 'Baby / childbirth' },
  { value: 'akshaya_tritiya', label: 'Akshaya Tritiya' },
  { value: 'vishu', label: 'Vishu' },
  { value: 'onam', label: 'Onam' },
  { value: 'other', label: 'Other' },
];

export const MARRIAGE_OCCASIONS = [
  'daughter_marriage',
  'son_marriage',
  'own_marriage',
  'engagement',
];

export function isMarriageOccasion(key) {
  return MARRIAGE_OCCASIONS.includes(key);
}

export const FOLLOWUP_PRESETS = [
  { value: 'none', label: 'No follow-up' },
  { value: '1_month', label: '1 month' },
  { value: '3_months', label: '3 months' },
  { value: '1_year', label: '1 year' },
  { value: 'custom', label: 'Custom date' },
];

export const FOLLOWUP_DATE_CHIPS = [
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '1 year', days: 365 },
];

export function addDaysLocal(days, options = {}) {
  const withTime = !!options.withTime;
  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (!withTime) return date;
  return `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function occasionLabel(key) {
  if (!key) return '';
  const found = JEWELLERY_OCCASIONS.find((item) => item.value === key);
  return found ? found.label : key;
}

export function formatClientPlace(obj = {}) {
  return [obj.house_name, obj.street, obj.village, obj.panchayath, obj.district, obj.state]
    .filter(Boolean)
    .join(', ');
}

export function leadSearchText(obj = {}) {
  return [
    obj.name, obj.phone, obj.mobile2, obj.email,
    obj.house_name, obj.street, obj.village, obj.panchayath, obj.district, obj.state,
    obj.bride_name, obj.father_name, obj.notes, obj.product_interest,
    obj.occasion, obj.occasion_label, obj.referred_by,
    formatClientPlace(obj),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function leadMatchesSearch(obj, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = leadSearchText(obj);
  return q.split(/\s+/).every((term) => hay.includes(term));
}
