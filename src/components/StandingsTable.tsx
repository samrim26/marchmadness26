"use client";

import { useState } from "react";
import type { EntryAnalytics } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { formatPercent } from "@/lib/format";

type SortKey =
  | "rank"
  | "currentScore"
  | "maxPossibleScore"
  | "firstOrTieProbability"
  | "soloWinProbability";

interface Props {
  analytics: EntryAnalytics[];
}

export function StandingsTable({ analytics }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("firstOrTieProbability");
  const [sortAsc, setSortAsc] = useState(false);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = [...analytics].sort((a, b) => {
    const mul = sortAsc ? 1 : -1;
    return mul * (a[sortKey] - b[sortKey]);
  });

  function SortHeader({
    col,
    label,
    title,
  }: {
    col: SortKey;
    label: string;
    title?: string;
  }) {
    const active = sortKey === col;
    return (
      <th
        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
        onClick={() => handleSort(col)}
        title={title}
      >
        {label}
        {active && (
          <span className="ml-1 text-blue-400">{sortAsc ? "↑" : "↓"}</span>
        )}
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
              Entry
            </th>
            <SortHeader col="currentScore" label="Points" title="Current score" />
            <SortHeader
              col="maxPossibleScore"
              label="Max"
              title="Maximum possible score"
            />
            <SortHeader
              col="soloWinProbability"
              label="Solo Win %"
              title="Probability of finishing in sole first place"
            />
            <SortHeader
              col="firstOrTieProbability"
              label="Win or Tie %"
              title="Probability of finishing first or tied for first"
            />
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {sorted.map((a, i) => (
            <tr
              key={a.entryId}
              className={`table-row-hover transition-colors ${
                a.eliminated ? "opacity-50" : ""
              }`}
            >
              <td className="px-4 py-3 text-slate-500 tabular-nums">
                {i + 1}
              </td>
              <td className="px-4 py-3 font-medium text-white">
                {a.displayName}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                {a.currentScore}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                {a.maxPossibleScore}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`tabular-nums ${
                    a.soloWinProbability === 0
                      ? "text-slate-500"
                      : "text-blue-300"
                  }`}
                >
                  {formatPercent(a.soloWinProbability)}
                </span>
              </td>
              <td className="px-4 py-3">
                <ProbabilityBar
                  value={a.firstOrTieProbability}
                  color={
                    a.eliminated
                      ? "slate"
                      : a.rank === 1
                      ? "blue"
                      : "emerald"
                  }
                />
              </td>
              <td className="px-4 py-3">
                <StatusBadge analytics={a} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
