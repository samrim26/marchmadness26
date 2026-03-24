import type { Metadata } from "next";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";

import { SCORING_SETTINGS } from "@/data/settings";
import { getResults } from "@/lib/getResults";

export const dynamic = "force-dynamic";
import { computeScenarioDeltas } from "@/lib/rooting";
import { computeEntryProbabilities } from "@/lib/simulation";
import { getGamesWithKnownParticipants, getGameParticipant } from "@/lib/bracket";
import { formatPercent } from "@/lib/format";

export const metadata: Metadata = {
  title: "Scenarios | March Madness 2026",
};

export default async function ScenariosPage() {
  const RESULTS = await getResults();
  const analytics = computeEntryProbabilities(
    ENTRIES,
    GAMES,
    RESULTS,
    SCORING_SETTINGS
  );
  const deltas = computeScenarioDeltas(ENTRIES, GAMES, RESULTS, SCORING_SETTINGS);

  // Group deltas by game
  const byGame = new Map<string, typeof deltas>();
  for (const d of deltas) {
    const key = d.gameId;
    if (!byGame.has(key)) byGame.set(key, []);
    byGame.get(key)!.push(d);
  }

  const actionableGames = getGamesWithKnownParticipants(GAMES, RESULTS);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Scenario Analysis</h1>
        <p className="text-slate-400 mt-1">
          How each remaining game's outcome shifts everyone's win probability.
          Numbers show change from the current baseline probability.
        </p>
      </div>

      {actionableGames.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
          No games with known participants yet.
        </div>
      )}

      {actionableGames.map((game) => {
        const gameDeltaSet = byGame.get(game.id);
        if (!gameDeltaSet) return null;

        const t1 = getGameParticipant(game, "team1", RESULTS);
        const t2 = getGameParticipant(game, "team2", RESULTS);
        const d1 = gameDeltaSet.find((d) => d.winnerId === t1);
        const d2 = gameDeltaSet.find((d) => d.winnerId === t2);

        return (
          <div key={game.id} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">{game.label}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[d1, d2].filter(Boolean).map((scenario) => (
                <div
                  key={scenario!.winnerId}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <div className="font-semibold text-white mb-4">
                    If{" "}
                    <span className="text-blue-300">{scenario!.winnerName}</span>{" "}
                    wins
                  </div>
                  <div className="space-y-2">
                    {[...scenario!.deltas]
                      .sort((a, b) => b.after - a.after)
                      .map((ed) => {
                        const a = analytics.find(
                          (x) => x.entryId === ed.entryId
                        )!;
                        return (
                          <div
                            key={ed.entryId}
                            className={`flex items-center justify-between gap-3 text-sm ${
                              a.eliminated ? "opacity-50" : ""
                            }`}
                          >
                            <span className="text-slate-300 font-medium w-20 shrink-0">
                              {ed.displayName}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-slate-800">
                              <div
                                className="h-1.5 rounded-full bg-blue-500 transition-all"
                                style={{
                                  width: `${Math.max(0, ed.after * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="tabular-nums text-slate-300 w-12 text-right shrink-0">
                              {formatPercent(ed.after)}
                            </span>
                            <span
                              className={`tabular-nums text-xs w-12 text-right shrink-0 ${
                                ed.delta > 0.005
                                  ? "text-emerald-400"
                                  : ed.delta < -0.005
                                  ? "text-red-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {ed.delta >= 0 ? "+" : ""}
                              {(ed.delta * 100).toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Elimination scenarios */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          Elimination Watch
        </h2>
        <p className="text-sm text-slate-400">
          Entries that are not yet eliminated but have a low probability of
          winning.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analytics
            .filter((a) => !a.eliminated && a.firstOrTieProbability < 0.15)
            .sort((a, b) => a.firstOrTieProbability - b.firstOrTieProbability)
            .map((a) => (
              <div
                key={a.entryId}
                className="rounded-xl border border-orange-800/30 bg-orange-900/10 p-4"
              >
                <div className="font-medium text-white">{a.displayName}</div>
                <div className="text-sm text-orange-400 mt-1">
                  {formatPercent(a.firstOrTieProbability)} chance —{" "}
                  {a.numberOfWinningScenarios + a.numberOfTieScenarios} of{" "}
                  {a.totalScenarios} paths
                </div>
              </div>
            ))}
          {analytics.filter(
            (a) => !a.eliminated && a.firstOrTieProbability < 0.15
          ).length === 0 && (
            <div className="col-span-full text-slate-500 py-4">
              No entries near elimination.
            </div>
          )}
        </div>

        {/* Already eliminated */}
        {analytics.some((a) => a.eliminated) && (
          <div className="space-y-2 mt-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Eliminated
            </h3>
            <div className="flex flex-wrap gap-2">
              {analytics
                .filter((a) => a.eliminated)
                .map((a) => (
                  <span
                    key={a.entryId}
                    className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-500 line-through"
                  >
                    {a.displayName}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
