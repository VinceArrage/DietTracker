import type { Portion } from '../domain/types';

/** One decimal, without a trailing ".0". */
export function fmt1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

export function fmtInt(n: number): string {
  return String(Math.round(n));
}

export function formatPortion(p: Portion): string {
  return p.unit === 'g' ? `${fmt1(p.quantity)} g` : `${fmt1(p.quantity)} × ${p.unit}`;
}

/** "2026-10-30" → "Fri 30 Oct" (local date). */
export function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
