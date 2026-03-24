/**
 * Format a probability (0–1) as a percentage string.
 * e.g. 0.375 → "37.5%"
 */
export function formatPercent(p: number): string {
  return (p * 100).toFixed(1) + "%";
}

/**
 * Format a point value.
 */
export function formatPoints(n: number): string {
  return n.toString();
}

/**
 * Format entry status for display.
 */
export function formatStatus(
  eliminated: boolean,
  firstOrTieProbability: number
): string {
  if (eliminated) return "Eliminated";
  if (firstOrTieProbability >= 0.5) return "Leader";
  return "Alive";
}

/**
 * Return a CSS colour class for a probability value.
 */
export function probColorClass(p: number): string {
  if (p === 0) return "text-slate-500";
  if (p >= 0.5) return "text-emerald-400";
  if (p >= 0.2) return "text-yellow-400";
  return "text-orange-400";
}

/**
 * Return a delta label with sign.
 */
export function formatDelta(d: number): string {
  const pct = (d * 100).toFixed(1);
  return d >= 0 ? `+${pct}%` : `${pct}%`;
}
