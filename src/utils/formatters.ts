/**
 * Safe formatting utilities for dates, numbers, and strings.
 * Prevents runtime RangeError exceptions on invalid or undefined dates.
 */

export function parseSafeDate(v?: string | number | Date | null): Date | null {
  if (v === null || v === undefined || v === '') return null;
  let val: number | string | Date = v;
  if (typeof v === 'number' && v > 0 && v < 1e11) {
    val = v * 1000;
  }
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function formatUtc(v?: string | number | Date | null): string {
  const d = parseSafeDate(v);
  if (!d) return '—';
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

export function formatIso(v?: string | number | Date | null): string {
  const d = parseSafeDate(v);
  if (!d) return '—';
  return d.toISOString();
}

export function formatTime(v?: string | number | Date | null): string {
  const d = parseSafeDate(v);
  if (!d) return '—';
  return d.toLocaleTimeString('en-US', { hour12: false });
}
