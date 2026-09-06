import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function normalizeGrams(val) {
  if (!val) return 0;
  let num = parseFloat(val);
  if (isNaN(num)) return 0;
  // If the value is unrealistically high for grams (e.g. > 1000), 
  // it is likely legacy INR data. Convert it to grams.
  if (num > 1000) {
    return num / 7500;
  }
  return num;
}

export function formatGrams(val, decimals = 1) {
  return normalizeGrams(val).toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

/** Newest lead on a customer, independent of array order. */
export function latestLead(leads) {
  if (!Array.isArray(leads) || leads.length === 0) return null;
  return leads.reduce((best, lead) => {
    if (!best) return lead;
    const bestTime = new Date(best.created_at || 0).getTime();
    const leadTime = new Date(lead.created_at || 0).getTime();
    if (leadTime !== bestTime) return leadTime > bestTime ? lead : best;
    return (lead.id || 0) > (best.id || 0) ? lead : best;
  }, null);
}

export function indianWhatsAppNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(-10)}`;
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(-12);
  return digits;
}
