export function hasCoords(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && !(la === 0 && ln === 0);
}

export function googleMapsViewUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function googleMapsNavigateUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
