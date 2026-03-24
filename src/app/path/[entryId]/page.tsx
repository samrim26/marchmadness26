import { notFound } from "next/navigation";
import Link from "next/link";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";
import { getTeamName } from "@/data/teams";
import { getResults } from "@/lib/getResults";
import { getWinningOutcomes } from "@/lib/simulation";
import { calculateCurrentScore, calculateMaxPossibleScore } from "@/lib/scoring";
import { sortGamesByRound, getRemainingGames } from "@/lib/bracket";
import { formatPercent } from "@/lib/format";
import type { Game, Results } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROUND_LABELS: Record<string, string> = {
  sweet16: "Sweet 16",
  elite8: "Elite 8",
  final4: "Final Four",
  championship: "Championship",
};

/** Get team IDs for a game using a specific path's outcomes (not current results). */
function resolveParticipants(game: Game, path: Results): [string | null, string | null] {
  const t1 = game.team1Id ?? (game.team1SourceGameId ? path[game.team1SourceGameId] ?? null : null);
  const t2 = game.team2Id ?? (game.team2SourceGameId ? path[game.team2SourceGameId] ?? null : null);
  return [t1, t2];
}

export default async function PathPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const entry = ENTRIES.find((e) => e.id === entryId);
  if (!entry) notFound();

  const results = await getResults();
  const remaining = sortGamesByRound(getRemainingGames(GAMES, results));

  const winningPaths = getWinningOutcomes(entryId, ENTRIES, GAMES, results);
  const totalScenarios = Math.pow(2, remaining.length);
  const currentScore = calculateCurrentScore(entry, GAMES, results);
  const maxScore = calculateMaxPossibleScore(entry, GAMES, results);
  const winPct = winningPaths.length / totalScenarios;

  /**
   * For each remaining game, count how many winning paths have each team winning.
   * We count by team ID directly from path outcomes — works for all rounds,
   * including Elite 8+ where participants depend on prior results.
   */
  const gameAnalysis = remaining.map((game) => {
    const pick = entry.picks[game.id] ?? null;
    const winCounts = new Map<string, number>();
    for (const path of winningPaths) {
      const winner = path[game.id];
      if (winner) winCounts.set(winner, (winCounts.get(winner) ?? 0) + 1);
    }
    const total = winningPaths.length;
    const teams = [...winCounts.entries()]
      .map(([teamId, wins]) => ({ teamId, wins, pct: total > 0 ? wins / total : 0 }))
      .sort((a, b) => b.wins - a.wins);

    const mustWin = teams.length === 1 && total > 0;
    const requiredWinner = mustWin ? teams[0].teamId : null;

    return { game, teams, total, pick, mustWin, requiredWinner };
  });

  const mustWinGames = gameAnalysis.filter((g) => g.mustWin);
  const variableGames = gameAnalysis.filter((g) => !g.mustWin && g.teams.length > 0);

  // Show individual paths only when there are ≤ 64
  const showPaths = winningPaths.length > 0 && winningPaths.length <= 64;

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Link
        href="/standings"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        ← Back to Standings
      </Link>

      {/* Entry header */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-6 space-y-2">
        <h1 className="text-2xl font-bold text-white">{entry.displayName}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
          <span>
            <span className="text-white font-medium">{currentScore}</span> pts current
          </span>
          <span>
            <span className="text-white font-medium">{maxScore}</span> pts max possible
          </span>
          <span className={`font-medium ${winningPaths.length > 0 ? "text-blue-300" : "text-red-400"}`}>
            {winningPaths.length > 0 ? formatPercent(winPct) : "Eliminated"}
          </span>
          <span className="text-slate-500">
            {winningPaths.length} of {totalScenarios} paths lead to a win
          </span>
        </div>
      </div>

      {winningPaths.length === 0 ? (
        <div className="rounded-xl border border-red-800/40 bg-red-900/10 p-8 text-center space-y-2">
          <div className="text-red-400 text-lg font-semibold">Eliminated</div>
          <div className="text-slate-400 text-sm">
            There are no remaining tournament outcomes where this entry finishes first or tied for first.
          </div>
        </div>
      ) : (
        <>
          {/* Must-win games */}
          {mustWinGames.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Must Happen</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Required in every single winning path.
                </p>
              </div>
              <div className="space-y-2">
                {mustWinGames.map(({ game, requiredWinner, pick }) => {
                  const reqName = getTeamName(requiredWinner ?? "");
                  const isPick = pick === requiredWinner;
                  return (
                    <div
                      key={game.id}
                      className="flex items-center gap-3 rounded-lg border border-emerald-800/50 bg-emerald-900/15 px-4 py-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0 text-sm">
                        <span className="font-semibold text-white">{reqName}</span>
                        <span className="text-slate-400"> must win </span>
                        <span className="text-slate-400">{game.label}</span>
                      </div>
                      {isPick ? (
                        <span className="text-xs text-emerald-400 shrink-0">your pick ✓</span>
                      ) : pick ? (
                        <span className="text-xs text-amber-400 shrink-0">
                          you picked {getTeamName(pick)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variable games */}
          {variableGames.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Can Go Either Way</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Both outcomes appear in winning paths — bar shows how often each team wins.
                </p>
              </div>
              <div className="space-y-3">
                {variableGames.map(({ game, teams, total, pick }) => (
                  <div
                    key={game.id}
                    className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 space-y-2"
                  >
                    <div className="text-sm text-slate-400">{game.label}</div>
                    {teams.map(({ teamId, wins, pct }) => (
                      <div key={teamId} className="flex items-center gap-3 text-sm">
                        <div className="w-32 shrink-0 flex items-center gap-1.5">
                          <span className={`font-medium ${pick === teamId ? "text-white" : "text-slate-300"}`}>
                            {getTeamName(teamId)}
                          </span>
                          {pick === teamId && <span className="text-xs text-blue-400">✓</span>}
                        </div>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 0.6 ? "bg-emerald-500" : pct >= 0.4 ? "bg-blue-500" : "bg-slate-600"}`}
                            style={{ width: `${pct * 100}%` }}
                          />
                        </div>
                        <div className="w-20 text-right tabular-nums text-slate-400 shrink-0 text-xs">
                          {wins}/{total} ({Math.round(pct * 100)}%)
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual paths */}
          {showPaths && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  All {winningPaths.length} Winning Path{winningPaths.length !== 1 ? "s" : ""}
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Each card shows the exact sequence of results needed from every remaining game.
                </p>
              </div>
              <div className="space-y-3">
                {winningPaths.map((path, i) => (
                  <PathCard
                    key={i}
                    index={i + 1}
                    path={path}
                    games={remaining}
                    picks={entry.picks}
                  />
                ))}
              </div>
            </div>
          )}

          {winningPaths.length > 64 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-center text-slate-400 text-sm">
              {winningPaths.length} winning paths — too many to list individually.
              The sections above summarize what needs to happen across all of them.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PathCard({
  index,
  path,
  games,
  picks,
}: {
  index: number;
  path: Results;
  games: Game[];
  picks: Record<string, string>;
}) {
  const rounds = ["sweet16", "elite8", "final4", "championship"];
  const byRound = new Map<string, Game[]>();
  for (const game of games) {
    if (!byRound.has(game.round)) byRound.set(game.round, []);
    byRound.get(game.round)!.push(game);
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        Path {index}
      </div>
      {rounds.filter((r) => byRound.has(r)).map((round) => (
        <div key={round}>
          <div className="text-xs text-slate-500 mb-1.5">{ROUND_LABELS[round]}</div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {byRound.get(round)!.map((game) => {
              const winner = path[game.id];
              const winnerName = getTeamName(winner ?? "");
              // Resolve loser using path outcomes for this specific scenario
              const [t1, t2] = resolveParticipants(game, path);
              const loser = winner === t1 ? t2 : t1;
              const loserName = getTeamName(loser ?? "");
              const isPick = picks[game.id] === winner;
              return (
                <div
                  key={game.id}
                  className="flex items-center gap-2 text-sm rounded bg-slate-800/60 px-2.5 py-1.5"
                >
                  <span className="font-medium text-white">{winnerName}</span>
                  <span className="text-slate-600 text-xs">def.</span>
                  <span className="text-slate-500 text-xs">{loserName}</span>
                  {isPick && (
                    <span className="ml-auto text-xs text-blue-400 shrink-0">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
