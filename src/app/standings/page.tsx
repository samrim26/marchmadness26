import type { Metadata } from "next";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";

import { SCORING_SETTINGS } from "@/data/settings";
import { getResults } from "@/lib/getResults";

export const dynamic = "force-dynamic";
import { computeEntryProbabilities } from "@/lib/simulation";
import { getRemainingGames, getCompletedGames } from "@/lib/bracket";
import { formatPercent } from "@/lib/format";
import Link from "next/link";
import { StandingsTable } from "@/components/StandingsTable";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata: Metadata = {
  title: "Standings | March Madness 2026",
};

export default async function StandingsPage() {
  const RESULTS = await getResults();
  const analytics = computeEntryProbabilities(
    ENTRIES,
    GAMES,
    RESULTS,
    SCORING_SETTINGS
  );
  const remaining = getRemainingGames(GAMES, RESULTS).length;
  const completed = getCompletedGames(GAMES, RESULTS).length;
  const totalGames = GAMES.length;

  // Max possible total points
  const maxTotal = GAMES.reduce((s, g) => s + g.pointsValue, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Standings</h1>
        <p className="text-slate-400 mt-1">
          {completed} of {totalGames} games complete · {remaining} remaining ·
          max {maxTotal} pts possible
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-slate-400">
        <span>
          <span className="text-white font-medium">Solo Win %</span> — probability
          of finishing in sole first place
        </span>
        <span>
          <span className="text-white font-medium">Win or Tie %</span> — probability
          of finishing first or tied for first
        </span>
        <span>
          <span className="text-white font-medium">Max</span> — maximum
          remaining points if all remaining picks hit
        </span>
      </div>

      <StandingsTable analytics={analytics} />

      {/* Entry detail cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Entry Detail</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...analytics]
            .sort(
              (a, b) =>
                b.firstOrTieProbability - a.firstOrTieProbability ||
                b.currentScore - a.currentScore
            )
            .map((a) => (
              <div
                key={a.entryId}
                className={`rounded-xl border p-5 space-y-3 transition-opacity ${
                  a.eliminated
                    ? "border-slate-800 bg-slate-900/30 opacity-60"
                    : "border-slate-700 bg-slate-900/70"
                }`}
              >
                <div className="flex items-start justify-between">
                  <Link href={`/path/${a.entryId}`} className="font-semibold text-white text-lg hover:text-blue-300 transition-colors">
                    {a.displayName}
                  </Link>
                  <StatusBadge analytics={a} />
                </div>

                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <StatRow label="Points" value={a.currentScore.toString()} />
                  <StatRow
                    label="Max Possible"
                    value={a.maxPossibleScore.toString()}
                  />
                  <StatRow
                    label="Solo Win"
                    value={formatPercent(a.soloWinProbability)}
                    highlight={a.soloWinProbability > 0}
                  />
                  <StatRow
                    label="Win or Tie"
                    value={formatPercent(a.firstOrTieProbability)}
                    highlight={a.firstOrTieProbability > 0}
                  />
                  <StatRow
                    label="Winning Paths"
                    value={`${a.numberOfWinningScenarios + a.numberOfTieScenarios} / ${a.totalScenarios}`}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <>
      <div className="text-slate-500">{label}</div>
      <div
        className={`text-right tabular-nums font-medium ${
          highlight ? "text-blue-300" : "text-slate-300"
        }`}
      >
        {value}
      </div>
    </>
  );
}
