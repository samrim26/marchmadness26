import type { Metadata } from "next";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";
import { SCORING_SETTINGS } from "@/data/settings";
import { getResults } from "@/lib/getResults";
import { PRIZE_CONFIG, parseBracketName } from "@/data/prizeConfig";
import { getGamesWithKnownParticipants, getGameParticipant } from "@/lib/bracket";
import { getTeamName } from "@/data/teams";
import { computeEntryProbabilities, buildOutcomeRowsForState, conditionalPoolEVs, computeConditionalWinProbs } from "@/lib/simulation";
import { getManualOdds, manualOddsToGameProbs } from "@/lib/manualOdds";
import HedgingClient from "./HedgingClient";
import type { SerializedGame, SerializedEntry } from "./HedgingClient";

export const metadata: Metadata = {
  title: "Hedging Guide | March Madness 2026",
};

export const dynamic = "force-dynamic";

export default async function HedgingPage() {
  const RESULTS = await getResults();
  const manualOdds = await getManualOdds();
  const gameProbs = manualOddsToGameProbs(manualOdds, GAMES, RESULTS);

  const analytics = computeEntryProbabilities(ENTRIES, GAMES, RESULTS, SCORING_SETTINGS, gameProbs);

  // Pre-compute conditional EVs server-side (expensive enumeration stays on server)
  const outcomeRows = buildOutcomeRowsForState(ENTRIES, GAMES, RESULTS, gameProbs);
  const overallEVs = conditionalPoolEVs(outcomeRows, ENTRIES.length);

  const upcomingGames = getGamesWithKnownParticipants(GAMES, RESULTS);

  const serializedGames: SerializedGame[] = upcomingGames.map((game) => {
    const t1 = getGameParticipant(game, "team1", RESULTS)!;
    const t2 = getGameParticipant(game, "team2", RESULTS)!;
    const rowsIfT1 = outcomeRows.filter((r) => r.outcome[game.id] === t1);
    const rowsIfT2 = outcomeRows.filter((r) => r.outcome[game.id] === t2);
    return {
      gameId: game.id,
      gameLabel: game.label,
      team1Id: t1,
      team1Name: getTeamName(t1),
      team2Id: t2,
      team2Name: getTeamName(t2),
      evsIfTeam1Wins: conditionalPoolEVs(rowsIfT1, ENTRIES.length),
      evsIfTeam2Wins: conditionalPoolEVs(rowsIfT2, ENTRIES.length),
      pWinIfTeam1Wins: computeConditionalWinProbs(rowsIfT1, ENTRIES.length),
      pWinIfTeam2Wins: computeConditionalWinProbs(rowsIfT2, ENTRIES.length),
    };
  });

  const serializedEntries: SerializedEntry[] = ENTRIES.map((entry, i) => ({
    entryId: entry.id,
    displayName: entry.displayName,
    personName: parseBracketName(entry.displayName).personName,
    overallPoolEV: overallEVs[i],
  }));

  const totalPot = PRIZE_CONFIG.totalPot;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Hedging Guide</h1>
        <p className="text-slate-400 mt-1">
          Lock in guaranteed profit by betting against your pool position at a sportsbook.
        </p>
      </div>

      {/* Prize pool summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 grid sm:grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-white">${totalPot}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Total Pot</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-emerald-400">+${PRIZE_CONFIG.netIfFirst}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Net Profit (1st)</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-400">$0</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Net Profit (2nd)</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-400">-${PRIZE_CONFIG.entryFeePerPerson}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Net Loss (out)</div>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-blue-800/30 bg-blue-900/10 p-5 text-sm space-y-2">
        <div className="font-semibold text-blue-300 mb-1">How this works</div>
        <p className="text-slate-300">
          A hedge only appears here when one game is <strong className="text-white">truly make-or-break</strong> for a bracket — winning nearly locks first place and losing nearly locks you out. In that case, betting on the opposing team at a sportsbook lets you collect money either way.
        </p>
        <p className="text-slate-400">
          <strong className="text-white">The math:</strong> the bet size is calculated so that what you gain at the sportsbook (if your pick loses) exactly covers what you lose at the sportsbook (if your pick wins). Both paths result in the same positive dollar amount.
        </p>
      </div>

      {/* Live odds — fetched client-side from ESPN (no server IP blocking) */}
      <HedgingClient games={serializedGames} entries={serializedEntries} />

      {/* EV table — always visible */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Current Pool EV</h2>
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-400">Bracket</th>
                <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider text-slate-400">Win/Tie %</th>
                <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider text-slate-400">2nd %</th>
                <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider text-slate-400">Pool EV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[...analytics].sort((a, b) => b.poolEV - a.poolEV).map((a) => (
                <tr key={a.entryId} className={`table-row-hover ${a.eliminated ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-white">{a.displayName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-blue-300">
                    {(a.firstOrTieProbability * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
                    {(a.secondPlaceProbability * 100).toFixed(1)}%
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${a.poolEV > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {a.poolEV >= 0 ? "+" : ""}${a.poolEV.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
