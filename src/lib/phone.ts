/**
 * Shared Indian-mobile-number normalizers. Centralized so every caller
 * (WhatsApp links, Porter clipboard data, courier bookings) agrees on what
 * counts as a valid number and fails the same way — an empty string, never a
 * silently-corrupted or truncated one — when it doesn't.
 */

/** Strips everything except digits. */
function digitsOnly(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

/**
 * Normalizes to the bare 10-digit local form Porter/courier forms expect
 * ("+91 96068 88096" -> "9606888096"). Returns "" for anything that isn't a
 * plausible Indian mobile (10 digits, optionally prefixed with 0/91/+91).
 */
export function toLocal10(phone: string): string {
  let d = digitsOnly(phone);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) return d;
  return "";
}

/**
 * Normalizes to the international form wa.me links expect
 * ("+91 96068 88096" -> "919606888096"). Returns "" for anything invalid.
 */
export function toWaIntl(phone: string): string {
  const local = toLocal10(phone);
  return local ? `91${local}` : "";
}
