import type { EntryAnalytics } from "@/lib/types";

interface Props {
  analytics: EntryAnalytics;
}

export function StatusBadge({ analytics }: Props) {
  if (analytics.eliminated) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
        Eliminated
      </span>
    );
  }

  if (analytics.rank === 1 && analytics.firstOrTieProbability > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-900/60 px-2 py-0.5 text-xs font-medium text-blue-300 ring-1 ring-blue-500/40">
        Most Likely
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
      Alive
    </span>
  );
}
