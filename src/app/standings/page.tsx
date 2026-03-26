import type { Metadata } from "next";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";

import { SCORING_SETTINGS } from "@/data/settings";
import { getResults } from "@/lib/getResults";

export const dynamic = "force-dynamic";
import { computeEntryProbabilities } from "@/lib/simulation";
import { getRemainingGames, getCompletedGames } from "@/lib/bracket";
import { StandingsTable } from "@/components/StandingsTable";
import { getManualOdds, manualOddsToGameProbs } from "@/lib/manualOdds";

export const metadata: Metadata = {
  title: "Standings | March Madness 2026",
};

export default async function StandingsPage() {
  const RESULTS = await getResults();
  const manualOdds = await getManualOdds();
  const gameProbs = manualOddsToGameProbs(manualOdds, GAMES, RESULTS);
  const analytics = computeEntryProbabilities(
    ENTRIES,
    GAMES,
    RESULTS,
    SCORING_SETTINGS,
    gameProbs
  );
  const remaining = getRemainingGames(GAMES, RESULTS).length;
  const completed = getCompletedGames(GAMES, RESULTS).length;
  const totalGames = GAMES.length;
  const maxTotal = GAMES.reduce((s, g) => s + g.pointsValue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Standings</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {completed} of {totalGames} games complete · {remaining} remaining · {maxTotal} pts max
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
        <span><span className="text-slate-300 font-medium">Solo Win %</span> — sole first place</span>
        <span><span className="text-slate-300 font-medium">Win or Tie %</span> — first or tied for first</span>
        <span><span className="text-slate-300 font-medium">Max</span> — points if all remaining picks hit</span>
        <span className="text-slate-600">Click column headers to sort</span>
      </div>

      <StandingsTable analytics={analytics} />
    </div>
  );
}
