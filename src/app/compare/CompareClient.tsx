"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { getTeamName } from "@/data/teams";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EntryInfo {
  id: string;
  displayName: string;
  picks: Record<string, string>;
  currentScore: number;
  maxPossibleScore: number;
  firstOrTieProbability: number;
  soloWinProbability: number;
  eliminated: boolean;
  totalScenarios: number;
  winningPaths: number;
}

interface GameInfo {
  id: string;
  label: string;
  round: string;
  region: string;
  pointsValue: number;
  team1Id: string | null;
  team2Id: string | null;
  team1SourceGameId: string | null;
  team2SourceGameId: string | null;
}

type Results = Record<string, string>;
type CellStatus = "correct" | "wrong" | "alive" | "dead" | "none";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPickStillAlive(
  teamId: string,
  gameId: string,
  games: GameInfo[],
  results: Results
): boolean {
  if (results[gameId] !== undefined) return results[gameId] === teamId;
  const game = games.find((g) => g.id === gameId);
  if (!game) return false;
  if (game.team1Id === teamId || game.team2Id === teamId) return true;
  if (game.team1SourceGameId) {
    const src = results[game.team1SourceGameId];
    if (src === teamId) return true;
    if (src === undefined && isPickStillAlive(teamId, game.team1SourceGameId, games, results)) return true;
  }
  if (game.team2SourceGameId) {
    const src = results[game.team2SourceGameId];
    if (src === teamId) return true;
    if (src === undefined && isPickStillAlive(teamId, game.team2SourceGameId, games, results)) return true;
  }
  return false;
}

function getCellStatus(pick: string | undefined, gameId: string, games: GameInfo[], results: Results): CellStatus {
  if (!pick) return "none";
  const result = results[gameId];
  if (result) return result === pick ? "correct" : "wrong";
  return isPickStillAlive(pick, gameId, games, results) ? "alive" : "dead";
}

const STATUS_CLASSES: Record<CellStatus, string> = {
  correct: "bg-emerald-900/40 text-emerald-200 ring-1 ring-emerald-600/30",
  wrong:   "bg-red-900/20 text-red-400 line-through opacity-70",
  alive:   "bg-slate-800/50 text-slate-200",
  dead:    "bg-slate-900/30 text-slate-600",
  none:    "bg-slate-900/20 text-slate-700 italic",
};

const ROUND_LABELS: Record<string, string> = {
  sweet16:      "Sweet 16",
  elite8:       "Elite 8",
  final4:       "Final Four",
  championship: "Championship",
};

const ROUND_ORDER = ["sweet16", "elite8", "final4", "championship"];

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CompareClient({
  entries,
  games,
  results,
}: {
  entries: EntryInfo[];
  games: GameInfo[];
  results: Results;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const aId = params.get("a") ?? entries[0]?.id ?? "";
  const bId = params.get("b") ?? entries[1]?.id ?? "";

  function setA(id: string) {
    const p = new URLSearchParams(params.toString());
    p.set("a", id);
    router.replace(`/compare?${p.toString()}`);
  }
  function setB(id: string) {
    const p = new URLSearchParams(params.toString());
    p.set("b", id);
    router.replace(`/compare?${p.toString()}`);
  }

  const entryA = entries.find((e) => e.id === aId);
  const entryB = entries.find((e) => e.id === bId);

  // Count agreement/disagreement
  let same = 0, differ = 0;
  if (entryA && entryB) {
    for (const g of games) {
      const pA = entryA.picks[g.id];
      const pB = entryB.picks[g.id];
      if (pA && pB) {
        if (pA === pB) same++;
        else differ++;
      }
    }
  }

  // Group games by round
  const byRound = new Map<string, GameInfo[]>();
  for (const round of ROUND_ORDER) {
    byRound.set(round, games.filter((g) => g.round === round));
  }

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div className="grid sm:grid-cols-2 gap-3">
        <SelectorCard
          label="Bracket A"
          value={aId}
          entries={entries}
          exclude={bId}
          accent="blue"
          onChange={setA}
        />
        <SelectorCard
          label="Bracket B"
          value={bId}
          entries={entries}
          exclude={aId}
          accent="purple"
          onChange={setB}
        />
      </div>

      {entryA && entryB && (
        <>
          {/* Summary stats */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-slate-500 font-medium w-1/3" />
                  <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-widest text-blue-500 font-semibold w-1/3">
                    {entryA.displayName}
                  </th>
                  <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-widest text-purple-400 font-semibold w-1/3">
                    {entryB.displayName}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                <StatRow label="Points" a={entryA.currentScore.toString()} b={entryB.currentScore.toString()} compareNum={entryA.currentScore - entryB.currentScore} />
                <StatRow label="Max Possible" a={entryA.maxPossibleScore.toString()} b={entryB.maxPossibleScore.toString()} compareNum={entryA.maxPossibleScore - entryB.maxPossibleScore} />
                <StatRow label="Win or Tie %" a={fmtPct(entryA.firstOrTieProbability)} b={fmtPct(entryB.firstOrTieProbability)} compareNum={entryA.firstOrTieProbability - entryB.firstOrTieProbability} />
                <StatRow label="Solo Win %" a={fmtPct(entryA.soloWinProbability)} b={fmtPct(entryB.soloWinProbability)} compareNum={entryA.soloWinProbability - entryB.soloWinProbability} />
                <StatRow label="Winning Paths" a={`${entryA.winningPaths}/${entryA.totalScenarios}`} b={`${entryB.winningPaths}/${entryB.totalScenarios}`} />
              </tbody>
            </table>
          </div>

          {/* Agreement summary */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">Picks overlap:</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-900/30 border border-emerald-800/40 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              ✓ {same} same
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-900/30 border border-amber-800/40 px-2.5 py-1 text-xs font-semibold text-amber-300">
              ≠ {differ} different
            </span>
          </div>

          {/* Game-by-game comparison */}
          <div className="space-y-4">
            {ROUND_ORDER.map((round) => {
              const roundGames = byRound.get(round) ?? [];
              if (roundGames.length === 0) return null;

              return (
                <div key={round}>
                  {/* Round header */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      {ROUND_LABELS[round]}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {roundGames[0].pointsValue} pts each
                    </span>
                    <div className="flex-1 h-px bg-slate-800/60" />
                  </div>

                  <div className="card overflow-hidden divide-y divide-slate-800/40">
                    {roundGames.map((game) => {
                      const pickA = entryA.picks[game.id];
                      const pickB = entryB.picks[game.id];
                      const statusA = getCellStatus(pickA, game.id, games, results);
                      const statusB = getCellStatus(pickB, game.id, games, results);
                      const agree = pickA && pickB && pickA === pickB;
                      const winner = results[game.id];

                      // Short game label: region + matchup
                      const matchupLabel = game.label
                        .replace(/ \(.*\)/, "")       // strip parenthetical
                        .replace("Regional Final", "")
                        .replace("National ", "")
                        .trim();

                      return (
                        <div key={game.id} className={`px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 ${agree ? "" : "bg-amber-950/10"}`}>
                          {/* Pick A */}
                          <div className="flex flex-col items-start gap-1">
                            <PickBadge
                              pick={pickA}
                              status={statusA}
                              winner={winner}
                              accent="blue"
                            />
                          </div>

                          {/* Center: game info + agree indicator */}
                          <div className="flex flex-col items-center gap-1 min-w-[100px] text-center">
                            <span className="text-[10px] text-slate-500 leading-tight">{matchupLabel}</span>
                            {pickA && pickB ? (
                              agree ? (
                                <span className="text-[10px] font-semibold text-emerald-500">= same</span>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-400">≠ split</span>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-700">—</span>
                            )}
                          </div>

                          {/* Pick B */}
                          <div className="flex flex-col items-end gap-1">
                            <PickBadge
                              pick={pickB}
                              status={statusB}
                              winner={winner}
                              accent="purple"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SelectorCard({
  label,
  value,
  entries,
  exclude,
  accent,
  onChange,
}: {
  label: string;
  value: string;
  entries: EntryInfo[];
  exclude: string;
  accent: "blue" | "purple";
  onChange: (id: string) => void;
}) {
  const accentClasses = {
    blue:   "border-blue-900/50 bg-blue-950/20 text-blue-400",
    purple: "border-purple-900/50 bg-purple-950/20 text-purple-400",
  }[accent];

  const selectClasses = {
    blue:   "bg-slate-900 border-blue-900/50 text-white focus:border-blue-500",
    purple: "bg-slate-900 border-purple-900/50 text-white focus:border-purple-500",
  }[accent];

  const selected = entries.find((e) => e.id === value);

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${accentClasses}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-widest ${accentClasses.split(" ").pop()}`}>
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${selectClasses}`}
      >
        {entries
          .filter((e) => e.id !== exclude)
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.displayName}{e.eliminated ? " (eliminated)" : ""}
            </option>
          ))}
      </select>
      {selected && (
        <div className="flex gap-3 text-xs text-slate-400">
          <span><span className="text-white font-medium">{selected.currentScore}</span> pts</span>
          <span><span className="text-white font-medium">{fmtPct(selected.firstOrTieProbability)}</span> win/tie</span>
          {selected.eliminated && <span className="text-red-500">Eliminated</span>}
        </div>
      )}
    </div>
  );
}

function PickBadge({
  pick,
  status,
  winner,
  accent,
}: {
  pick: string | undefined;
  status: CellStatus;
  winner: string | undefined;
  accent: "blue" | "purple";
}) {
  if (!pick) {
    return <span className="text-xs text-slate-700 italic">No pick</span>;
  }

  const name = getTeamName(pick);

  // Override correct/alive color with accent when alive (unpromoted)
  const baseClass = status === "alive"
    ? accent === "blue"
      ? "bg-blue-900/30 text-blue-200 ring-1 ring-blue-700/30"
      : "bg-purple-900/30 text-purple-200 ring-1 ring-purple-700/30"
    : STATUS_CLASSES[status];

  return (
    <span className={`inline-block rounded-lg px-3 py-1.5 text-sm font-medium ${baseClass}`}>
      {name}
    </span>
  );
}

function StatRow({
  label,
  a,
  b,
  compareNum,
}: {
  label: string;
  a: string;
  b: string;
  compareNum?: number;
}) {
  const aWins = compareNum != null && compareNum > 0.0005;
  const bWins = compareNum != null && compareNum < -0.0005;

  return (
    <tr className="table-row-hover">
      <td className="px-4 py-2.5 text-slate-500 text-xs">{label}</td>
      <td className={`px-4 py-2.5 text-center tabular-nums font-medium text-sm ${aWins ? "text-blue-300" : "text-slate-300"}`}>
        {a}
        {aWins && <span className="ml-1 text-[10px] text-blue-500">▲</span>}
      </td>
      <td className={`px-4 py-2.5 text-center tabular-nums font-medium text-sm ${bWins ? "text-purple-300" : "text-slate-300"}`}>
        {b}
        {bWins && <span className="ml-1 text-[10px] text-purple-500">▲</span>}
      </td>
    </tr>
  );
}
