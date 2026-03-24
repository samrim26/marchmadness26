"use client";

import type { EntryRootingData, RootingRecommendation } from "@/lib/types";
import { formatPercent } from "@/lib/format";

interface Props {
  rootingData: EntryRootingData[];
  entryNames: Record<string, string>; // entryId → displayName
}

function cellBg(rec: RootingRecommendation): string {
  if (!rec.preferredTeamId) return "bg-slate-800/30 text-slate-500";
  switch (rec.strength) {
    case "strong":
      return "bg-emerald-900/50 text-emerald-300";
    case "moderate":
      return "bg-emerald-900/30 text-emerald-400";
    case "slight":
      return "bg-slate-700/40 text-slate-300";
    default:
      return "bg-slate-800/30 text-slate-500";
  }
}

export function RootingMatrix({ rootingData, entryNames }: Props) {
  if (rootingData.length === 0 || rootingData[0].recommendations.length === 0) {
    return (
      <p className="text-slate-400 py-8 text-center">
        No games with known participants yet.
      </p>
    );
  }

  const games = rootingData[0].recommendations;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-xs">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 whitespace-nowrap">
              Entry
            </th>
            {games.map((g) => (
              <th
                key={g.gameId}
                className="px-3 py-3 text-center text-xs font-medium text-slate-400 max-w-[120px]"
              >
                <div className="leading-tight">{g.team1Name}</div>
                <div className="text-slate-600">vs</div>
                <div className="leading-tight">{g.team2Name}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {rootingData.map((ed) => (
            <tr key={ed.entryId} className="table-row-hover">
              <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                {entryNames[ed.entryId]}
              </td>
              {ed.recommendations.map((rec) => (
                <td
                  key={rec.gameId}
                  className={`px-3 py-3 text-center rounded transition-colors ${cellBg(rec)}`}
                  title={
                    rec.preferredTeamId
                      ? `Root for ${rec.preferredTeamName} (+${(rec.delta * 100).toFixed(1)}% win chance)`
                      : "No preference"
                  }
                >
                  {rec.preferredTeamId ? (
                    <div>
                      <div className="font-semibold">{rec.preferredTeamName}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">
                        +{(rec.delta * 100).toFixed(1)}%
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
