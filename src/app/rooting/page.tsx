import type { Metadata } from "next";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";

import { SCORING_SETTINGS } from "@/data/settings";
import { getResults } from "@/lib/getResults";

export const dynamic = "force-dynamic";
import { getAllRootingData } from "@/lib/rooting";
import { computeEntryProbabilities } from "@/lib/simulation";
import { getGamesWithKnownParticipants, getGameParticipant } from "@/lib/bracket";
import { formatPercent } from "@/lib/format";
import { RootingMatrix } from "@/components/RootingMatrix";

export const metadata: Metadata = {
  title: "Rooting Guide | March Madness 2026",
};

export default async function RootingPage() {
  const RESULTS = await getResults();
  const analytics = computeEntryProbabilities(
    ENTRIES,
    GAMES,
    RESULTS,
    SCORING_SETTINGS
  );
  const rootingData = getAllRootingData(ENTRIES, GAMES, RESULTS, SCORING_SETTINGS);
  const actionableGames = getGamesWithKnownParticipants(GAMES, RESULTS);

  const entryNames = Object.fromEntries(
    ENTRIES.map((e) => [e.id, e.displayName])
  );

  // Sort rooting data by entry probability (best first)
  const sortedRooting = [...rootingData].sort((a, b) => {
    const pa = analytics.find((x) => x.entryId === a.entryId)?.firstOrTieProbability ?? 0;
    const pb = analytics.find((x) => x.entryId === b.entryId)?.firstOrTieProbability ?? 0;
    return pb - pa;
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Rooting Guide</h1>
        <p className="text-slate-400 mt-1">
          Who each person should root for in every upcoming game. Probabilities
          are conditional on that team winning.
        </p>
      </div>

      {actionableGames.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
          All upcoming games are awaiting participants. Check back after Sweet 16 games complete.
        </div>
      )}

      {/* Matrix view */}
      {actionableGames.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Rooting Matrix</h2>
          <p className="text-sm text-slate-400">
            Each cell shows which team to root for and by how much it shifts win
            probability. — means no meaningful preference.
          </p>
          <RootingMatrix rootingData={sortedRooting} entryNames={entryNames} />
        </div>
      )}

      {/* Per-entry detail */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Per-Entry Detail</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {sortedRooting.map((ed) => {
            const a = analytics.find((x) => x.entryId === ed.entryId)!;
            return (
              <div
                key={ed.entryId}
                className={`rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 ${
                  a.eliminated ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white text-lg">
                    {a.displayName}
                  </div>
                  <span className="text-sm text-slate-400">
                    {formatPercent(a.firstOrTieProbability)} win/tie
                  </span>
                </div>

                {/* Best/worst game */}
                {ed.bestGame && ed.bestGame.preferredTeamId && (
                  <div className="rounded-lg bg-emerald-900/20 border border-emerald-800/40 p-3 text-sm">
                    <div className="text-emerald-400 font-medium mb-1">
                      Best game to win
                    </div>
                    <div className="text-slate-300">
                      Root for{" "}
                      <span className="font-semibold text-white">
                        {ed.bestGame.preferredTeamName}
                      </span>{" "}
                      in{" "}
                      <span className="text-slate-400">
                        {ed.bestGame.team1Name} vs {ed.bestGame.team2Name}
                      </span>
                    </div>
                    <div className="text-emerald-400/80 text-xs mt-1">
                      +{(ed.bestGame.delta * 100).toFixed(1)}% to your win
                      chance
                    </div>
                  </div>
                )}

                {/* All game recommendations */}
                <div className="space-y-1.5">
                  {ed.recommendations.map((rec) => (
                    <div
                      key={rec.gameId}
                      className="flex items-center justify-between text-sm gap-4"
                    >
                      <span className="text-slate-400 truncate min-w-0">
                        {rec.team1Name} vs {rec.team2Name}
                      </span>
                      {rec.preferredTeamId ? (
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="font-medium text-white">
                            {rec.preferredTeamName}
                          </span>
                          <span
                            className={`text-xs tabular-nums ${
                              rec.strength === "strong"
                                ? "text-emerald-400"
                                : rec.strength === "moderate"
                                ? "text-emerald-500"
                                : "text-slate-500"
                            }`}
                          >
                            +{(rec.delta * 100).toFixed(1)}%
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs shrink-0">
                          No preference
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
