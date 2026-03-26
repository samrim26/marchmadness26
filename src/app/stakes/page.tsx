import type { Metadata } from "next";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";
import { SCORING_SETTINGS } from "@/data/settings";
import { getResults } from "@/lib/getResults";
import { getManualOdds, manualOddsToGameProbs } from "@/lib/manualOdds";
import { computeScenarioDeltas } from "@/lib/rooting";
import { getGameParticipant } from "@/lib/bracket";
import { getTeamName } from "@/data/teams";
import { parseBracketName } from "@/data/prizeConfig";

export const metadata: Metadata = { title: "Game Stakes | March Madness 2026" };
export const dynamic = "force-dynamic";

function fmtDelta(d: number) {
  const pct = (d * 100).toFixed(1);
  return d > 0 ? `+${pct}%` : `${pct}%`;
}

function fmtProb(p: number) {
  return `${(p * 100).toFixed(1)}%`;
}

export default async function StakesPage() {
  const RESULTS = await getResults();
  const manualOdds = await getManualOdds();
  const gameProbs = manualOddsToGameProbs(manualOdds, GAMES, RESULTS);

  const deltas = computeScenarioDeltas(
    ENTRIES,
    GAMES,
    RESULTS,
    SCORING_SETTINGS,
    gameProbs
  );

  // Group deltas by game (each game has 2 entries: t1 wins, t2 wins)
  const gameIds = [...new Set(deltas.map((d) => d.gameId))];

  if (gameIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Game Stakes</h1>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
          No upcoming games with known participants.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Game Stakes</h1>
        <p className="text-slate-400 mt-1 text-sm">
          How much each upcoming game shifts everyone&apos;s win probability.
          Bigger swings = more riding on this game.
        </p>
      </div>

      {gameIds.map((gameId) => {
        const t1Delta = deltas.find((d) => d.gameId === gameId && d.winnerId !== deltas.find((x) => x.gameId === gameId && x.winnerId !== d.winnerId)?.winnerId);
        const pair = deltas.filter((d) => d.gameId === gameId);
        if (pair.length < 2) return null;

        const [d1, d2] = pair; // d1 = if t1 wins, d2 = if t2 wins
        const game = GAMES.find((g) => g.id === gameId)!;
        const t1Id = getGameParticipant(game, "team1", RESULTS);
        const t2Id = getGameParticipant(game, "team2", RESULTS);
        const t1Name = t1Id ? getTeamName(t1Id) : "TBD";
        const t2Name = t2Id ? getTeamName(t2Id) : "TBD";

        // Per entry: compute total swing = |prob if t1 wins - prob if t2 wins|
        const entrySwings = d1.deltas.map((e, i) => {
          const afterT1 = e.after;
          const afterT2 = d2.deltas[i].after;
          const swing = afterT1 - afterT2; // positive = prefers t1
          return {
            entryId: e.entryId,
            displayName: e.displayName,
            personName: parseBracketName(e.displayName).personName,
            before: e.before,
            afterT1,
            afterT2,
            swing,
            absSwing: Math.abs(swing),
          };
        });

        // Sort by absolute swing descending
        const sorted = [...entrySwings].sort((a, b) => b.absSwing - a.absSwing);
        const maxSwing = sorted[0]?.absSwing ?? 0;

        return (
          <div key={gameId} className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            {/* Game header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-base font-semibold text-white">{game.label}</div>
                <div className="text-sm text-slate-400 mt-0.5">
                  <span className="text-white">{t1Name}</span>
                  <span className="text-slate-600 mx-2">vs</span>
                  <span className="text-white">{t2Name}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Max swing: <span className="text-orange-300 font-medium">{fmtProb(maxSwing)}</span>
              </div>
            </div>

            {/* Stakes table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/40">
                    <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-500 font-medium">Bracket</th>
                    <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider text-slate-500 font-medium">Now</th>
                    <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider text-blue-400 font-medium">
                      If {t1Name} wins
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider text-purple-400 font-medium">
                      If {t2Name} wins
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider text-slate-500 font-medium">Swing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {sorted.map((e) => {
                    const prefersT1 = e.swing > 0;
                    const swingColor =
                      e.absSwing >= 0.05
                        ? "text-orange-300"
                        : e.absSwing >= 0.02
                        ? "text-yellow-400"
                        : "text-slate-500";

                    return (
                      <tr key={e.entryId} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-white">{e.displayName}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
                          {fmtProb(e.before)}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${prefersT1 ? "text-emerald-400" : "text-slate-400"}`}>
                          <span className="font-medium">{fmtProb(e.afterT1)}</span>
                          <span className={`text-xs ml-1 ${e.afterT1 > e.before ? "text-emerald-500" : e.afterT1 < e.before ? "text-red-500" : "text-slate-600"}`}>
                            {fmtDelta(e.afterT1 - e.before)}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${!prefersT1 ? "text-emerald-400" : "text-slate-400"}`}>
                          <span className="font-medium">{fmtProb(e.afterT2)}</span>
                          <span className={`text-xs ml-1 ${e.afterT2 > e.before ? "text-emerald-500" : e.afterT2 < e.before ? "text-red-500" : "text-slate-600"}`}>
                            {fmtDelta(e.afterT2 - e.before)}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${swingColor}`}>
                          {fmtProb(e.absSwing)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
