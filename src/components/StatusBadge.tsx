import type { EntryAnalytics } from "@/lib/types";

interface Props {
  analytics: EntryAnalytics;
}

export function StatusBadge({ analytics }: Props) {
  if (analytics.eliminated) {
    return (
      <span className="inline-flex items-center rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        Eliminated
      </span>
    );
  }

  if (analytics.rank === 1 && analytics.firstOrTieProbability > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-900/50 px-2 py-0.5 text-[11px] font-semibold text-blue-300 ring-1 ring-blue-600/30">
        <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
        Leader
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/30 px-2 py-0.5 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-700/30">
      <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
      Alive
    </span>
  );
}
