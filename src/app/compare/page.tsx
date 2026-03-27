import type { Metadata } from "next";
import { Suspense } from "react";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";
import { SCORING_SETTINGS } from "@/data/settings";
import { getResults } from "@/lib/getResults";
import { getManualOdds, manualOddsToGameProbs } from "@/lib/manualOdds";
import { computeEntryProbabilities } from "@/lib/simulation";
import { CompareClient } from "./CompareClient";

export const metadata: Metadata = { title: "Compare | March Madness 2026" };
export const dynamic = "force-dynamic";

export default async function ComparePage() {
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

  const entries = ENTRIES.map((e) => {
    const a = analytics.find((x) => x.entryId === e.id)!;
    return {
      id: e.id,
      displayName: e.displayName,
      picks: e.picks,
      currentScore: a.currentScore,
      maxPossibleScore: a.maxPossibleScore,
      firstOrTieProbability: a.firstOrTieProbability,
      soloWinProbability: a.soloWinProbability,
      eliminated: a.eliminated,
      totalScenarios: a.totalScenarios,
      winningPaths: a.numberOfWinningScenarios + a.numberOfTieScenarios,
    };
  });

  const games = GAMES.map((g) => ({
    id: g.id,
    label: g.label,
    round: g.round,
    region: g.region,
    pointsValue: g.pointsValue,
    team1Id: g.team1Id,
    team2Id: g.team2Id,
    team1SourceGameId: g.team1SourceGameId,
    team2SourceGameId: g.team2SourceGameId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Direct Comparison</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Pick any two brackets to compare their picks head-to-head.
        </p>
      </div>
      <Suspense>
        <CompareClient entries={entries} games={games} results={RESULTS} />
      </Suspense>
    </div>
  );
}
