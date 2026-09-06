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
