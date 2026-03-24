import { notFound } from "next/navigation";
import Link from "next/link";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";
import { SCORING_SETTINGS } from "@/data/settings";
import { getTeamName } from "@/data/teams";
import { getResults } from "@/lib/getResults";
import { getWinningOutcomes } from "@/lib/simulation";
import { calculateCurrentScore, calculateMaxPossibleScore } from "@/lib/scoring";
import { sortGamesByRound, getRemainingGames, getGameParticipant } from "@/lib/bracket";
import { formatPercent } from "@/lib/format";
import type { Results } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROUND_LABELS: Record<string, string> = {
  sweet16: "Sweet 16",
  elite8: "Elite 8",
  final4: "Final Four",
  championship: "Championship",
};

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

  // For each remaining game, count how many winning paths have each team winning
  const gameAnalysis = remaining.map((game) => {
    const t1 = getGameParticipant(game, "team1", results);
    const t2 = getGameParticipant(game, "team2", results);
    const pick = entry.picks[game.id] ?? null;

    let t1Wins = 0;
    let t2Wins = 0;
    for (const path of winningPaths) {
      if (path[game.id] === t1) t1Wins++;
      else if (path[game.id] === t2) t2Wins++;
    }

    const total = winningPaths.length;
    const t1Pct = total > 0 ? t1Wins / total : 0;
    const t2Pct = total > 0 ? t2Wins / total : 0;
    const mustWin = total > 0 && (t1Wins === total || t2Wins === total);
    const requiredWinner = t1Wins === total ? t1 : t2Wins === total ? t2 : null;

    return {
      game,
      t1,
      t2,
      t1Wins,
      t2Wins,
      t1Pct,
      t2Pct,
      pick,
      mustWin,
      requiredWinner,
    };
  });

  const mustWinGames = gameAnalysis.filter((g) => g.mustWin);
  const variableGames = gameAnalysis.filter((g) => !g.mustWin);

  // Show individual paths only when there are ≤ 64 of them
  const showPaths = winningPaths.length > 0 && winningPaths.length <= 64;

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Back */}
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
          <span>
            <span className={`font-medium ${winningPaths.length > 0 ? "text-blue-300" : "text-red-400"}`}>
              {winningPaths.length > 0 ? formatPercent(winPct) : "Eliminated"}
            </span>{" "}
            win/tie chance
          </span>
          <span className="text-slate-500">
            {winningPaths.length} of {totalScenarios} possible paths
          </span>
        </div>
      </div>

      {winningPaths.length === 0 ? (
        <div className="rounded-xl border border-red-800/40 bg-red-900/10 p-8 text-center space-y-2">
          <div className="text-red-400 text-lg font-semibold">Eliminated</div>
          <div className="text-slate-400 text-sm">
            There are no remaining tournament outcomes in which this entry can finish first or tied for first.
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
                  These outcomes are required in <em>every single</em> winning path.
                </p>
              </div>
              <div className="space-y-2">
                {mustWinGames.map(({ game, t1, t2, requiredWinner, pick }) => {
                  const reqName = getTeamName(requiredWinner ?? "");
                  const isPick = pick === requiredWinner;
                  return (
                    <div
                      key={game.id}
                      className="flex items-center gap-3 rounded-lg border border-emerald-800/50 bg-emerald-900/15 px-4 py-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-white">{reqName}</span>
                        <span className="text-slate-400 text-sm"> must win </span>
                        <span className="text-slate-400 text-sm">{game.label}</span>
                      </div>
                      {isPick ? (
                        <span className="text-xs text-emerald-400 shrink-0">your pick</span>
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
                  Both outcomes are possible — the bar shows how often each team appears in your winning paths.
                </p>
              </div>
              <div className="space-y-3">
                {variableGames.map(({ game, t1, t2, t1Wins, t2Wins, t1Pct, t2Pct, pick }) => (
                  <div key={game.id} className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 space-y-2">
                    <div className="text-sm text-slate-400">{game.label}</div>
                    <TeamBar
                      t1Id={t1}
                      t2Id={t2}
                      t1Wins={t1Wins}
                      t2Wins={t2Wins}
                      t1Pct={t1Pct}
                      t2Pct={t2Pct}
                      pick={pick}
                    />
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
                  Each card shows the complete sequence of results needed for this entry to win.
                </p>
              </div>
              <div className="space-y-3">
                {winningPaths.map((path, i) => (
                  <PathCard
                    key={i}
                    index={i + 1}
                    path={path}
                    games={remaining}
                    results={results}
                    picks={entry.picks}
                  />
                ))}
              </div>
            </div>
          )}

          {!showPaths && winningPaths.length > 64 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-center text-slate-400 text-sm">
              {winningPaths.length} winning paths — too many to list individually.
              The "Must Happen" and "Can Go Either Way" sections above summarize them all.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TeamBar({
  t1Id,
  t2Id,
  t1Wins,
  t2Wins,
  t1Pct,
  t2Pct,
  pick,
}: {
  t1Id: string | null;
  t2Id: string | null;
  t1Wins: number;
  t2Wins: number;
  t1Pct: number;
  t2Pct: number;
  pick: string | null;
}) {
  const t1Name = getTeamName(t1Id ?? "");
  const t2Name = getTeamName(t2Id ?? "");
  const total = t1Wins + t2Wins;

  return (
    <div className="space-y-1.5">
      {[
        { id: t1Id, name: t1Name, wins: t1Wins, pct: t1Pct },
        { id: t2Id, name: t2Name, wins: t2Wins, pct: t2Pct },
      ].map(({ id, name, wins, pct }) => (
        <div key={id} className="flex items-center gap-3 text-sm">
          <div className="w-28 shrink-0 flex items-center gap-1.5">
            <span className={`font-medium ${pick === id ? "text-white" : "text-slate-300"}`}>
              {name}
            </span>
            {pick === id && (
              <span className="text-xs text-blue-400">✓</span>
            )}
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-slate-800">
            <div
              className={`h-1.5 rounded-full transition-all ${
                pct >= 0.6 ? "bg-emerald-500" : pct >= 0.4 ? "bg-blue-500" : "bg-slate-600"
              }`}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <div className="w-20 text-right tabular-nums text-slate-400 shrink-0">
            {wins} / {total}
            <span className="text-slate-500 ml-1">({Math.round(pct * 100)}%)</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PathCard({
  index,
  path,
  games,
  results,
  picks,
}: {
  index: number;
  path: Results;
  games: ReturnType<typeof getRemainingGames>;
  results: Results;
  picks: Record<string, string>;
}) {
  const byRound = new Map<string, typeof games>();
  for (const game of games) {
    if (!byRound.has(game.round)) byRound.set(game.round, []);
    byRound.get(game.round)!.push(game);
  }

  const rounds = ["sweet16", "elite8", "final4", "championship"].filter((r) =>
    byRound.has(r)
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        Path {index}
      </div>
      {rounds.map((round) => (
        <div key={round}>
          <div className="text-xs text-slate-500 mb-1.5">{ROUND_LABELS[round]}</div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {byRound.get(round)!.map((game) => {
              const winner = path[game.id];
              const winnerName = getTeamName(winner ?? "");
              const isPick = picks[game.id] === winner;
              const t1 = getGameParticipant(game, "team1", results);
              const t2 = getGameParticipant(game, "team2", results);
              const loser = winner === t1 ? t2 : t1;
              const loserName = getTeamName(loser ?? "");
              return (
                <div
                  key={game.id}
                  className="flex items-center gap-2 text-sm rounded bg-slate-800/60 px-2.5 py-1.5"
                >
                  <span className="font-medium text-white">{winnerName}</span>
                  <span className="text-slate-600 text-xs">def.</span>
                  <span className="text-slate-500 text-xs">{loserName}</span>
                  {isPick && (
                    <span className="ml-auto text-xs text-blue-400 shrink-0">✓ pick</span>
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
