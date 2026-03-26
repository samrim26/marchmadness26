import Link from "next/link";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";
import { SCORING_SETTINGS } from "@/data/settings";
import { getTeamName } from "@/data/teams";
import { getRemainingGames, getCompletedGames, getGamesWithKnownParticipants, getGameParticipant } from "@/lib/bracket";
import { computeEntryProbabilities, buildOutcomeRowsForState } from "@/lib/simulation";
import { getResults } from "@/lib/getResults";
import { getManualOdds, manualOddsToGameProbs } from "@/lib/manualOdds";
import { formatPercent } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { LiveScoreboard } from "@/components/LiveScoreboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
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

  const remaining = getRemainingGames(GAMES, RESULTS);
  const completed = getCompletedGames(GAMES, RESULTS);
  const eliminated = analytics.filter((a) => a.eliminated).length;
  const alive = analytics.filter((a) => !a.eliminated).length;
  const leader = [...analytics].sort(
    (a, b) => b.currentScore - a.currentScore
  )[0];
  const mostLikely = [...analytics].sort(
    (a, b) => b.firstOrTieProbability - a.firstOrTieProbability
  )[0];
  // Bubble: alive brackets that would be eliminated by any single game result
  const outcomeRows = buildOutcomeRowsForState(ENTRIES, GAMES, RESULTS, gameProbs);
  const knownGames = getGamesWithKnownParticipants(GAMES, RESULTS);

  const bubbleEntries: { displayName: string; killers: string[] }[] = [];
  for (const entry of analytics.filter((a) => !a.eliminated)) {
    const ei = ENTRIES.findIndex((e) => e.id === entry.entryId);
    const killers: string[] = [];
    for (const game of knownGames) {
      const t1 = getGameParticipant(game, "team1", RESULTS);
      const t2 = getGameParticipant(game, "team2", RESULTS);
      if (!t1 || !t2) continue;
      const winsIfT1 = outcomeRows.some((r) => r.outcome[game.id] === t1 && r.scores[ei] === r.maxScore);
      const winsIfT2 = outcomeRows.some((r) => r.outcome[game.id] === t2 && r.scores[ei] === r.maxScore);
      if (!winsIfT1) killers.push(`${getTeamName(t1)} wins`);
      if (!winsIfT2) killers.push(`${getTeamName(t2)} wins`);
    }
    if (killers.length > 0) {
      bubbleEntries.push({ displayName: entry.displayName, killers });
    }
  }

  const tournamentProgress = Math.round((completed.length / GAMES.length) * 100);

  return (
    <div className="space-y-8">

      {/* Scoreboard strip */}
      <LiveScoreboard />

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            2026 March Madness
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {ENTRIES.length} brackets · {completed.length}/{GAMES.length} games complete
          </p>
        </div>
        {/* Progress bar */}
        <div className="hidden sm:flex flex-col items-end gap-1">
          <span className="text-xs text-slate-500">{tournamentProgress}% complete</span>
          <div className="w-32 h-1.5 rounded-full bg-slate-800">
            <div
              className="h-1.5 rounded-full bg-blue-500/70 transition-all"
              style={{ width: `${tournamentProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Brackets"
          value={ENTRIES.length.toString()}
          accent="blue"
        />
        <StatCard
          label="Games Left"
          value={remaining.length.toString()}
          accent={remaining.length > 0 ? "amber" : "slate"}
        />
        <StatCard
          label="Still Alive"
          value={alive.toString()}
          accent="emerald"
        />
        <StatCard
          label="Eliminated"
          value={eliminated.toString()}
          accent={eliminated > 0 ? "red" : "slate"}
        />
      </div>

      {/* Leaders */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="card p-5">
          <div className="stat-label mb-2">Current Leader</div>
          {leader ? (
            <>
              <div className="text-xl font-bold text-white">{leader.displayName}</div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-bold text-white tabular-nums">{leader.currentScore}</span>
                <span className="text-slate-500 text-sm">pts</span>
                <span className="text-slate-600 text-sm">·</span>
                <span className="text-slate-500 text-sm">max {leader.maxPossibleScore}</span>
              </div>
            </>
          ) : (
            <div className="text-slate-500">No data</div>
          )}
        </div>

        <div className="card p-5 border-blue-900/60 bg-blue-950/20 glow-blue">
          <div className="stat-label mb-2 text-blue-500">Most Likely to Win</div>
          {mostLikely && !mostLikely.eliminated ? (
            <>
              <div className="text-xl font-bold text-white">{mostLikely.displayName}</div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-bold text-blue-400 tabular-nums">
                  {formatPercent(mostLikely.firstOrTieProbability)}
                </span>
                <span className="text-slate-500 text-sm">first-or-tie chance</span>
              </div>
            </>
          ) : (
            <div className="text-slate-500">—</div>
          )}
        </div>
      </div>

      {/* Standings top 5 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Standings</h2>
          <Link href="/standings" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
            Full table →
          </Link>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-widest text-slate-500">#</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-widest text-slate-500">Entry</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-widest text-slate-500">Pts</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-widest text-slate-500">Win/Tie %</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-widest text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {[...analytics]
                .sort((a, b) =>
                  b.firstOrTieProbability - a.firstOrTieProbability ||
                  b.currentScore - a.currentScore ||
                  a.displayName.localeCompare(b.displayName)
                )
                .slice(0, 5)
                .map((a, i) => (
                  <tr key={a.entryId} className={`table-row-hover ${a.eliminated ? "opacity-40" : ""}`}>
                    <td className="px-4 py-2.5 text-slate-600 tabular-nums text-sm">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/path/${a.entryId}`} className="text-blue-400 hover:text-blue-300 transition-colors">
                        {a.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-300 font-medium">{a.currentScore}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-400 font-semibold">{formatPercent(a.firstOrTieProbability)}</td>
                    <td className="px-4 py-2.5"><StatusBadge analytics={a} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-slate-900/40 border-t border-slate-800/60 text-center">
            <Link href="/standings" className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
              View all {analytics.length} brackets →
            </Link>
          </div>
        </div>
      </div>

      {/* On the bubble */}
      {bubbleEntries.length > 0 && (
        <div>
          <h2 className="section-title mb-3">On the Bubble</h2>
          <div className="card border-amber-900/40 bg-amber-950/10 divide-y divide-amber-900/20">
            {bubbleEntries.map(({ displayName, killers }) => (
              <div key={displayName} className="px-4 py-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
                <span className="font-semibold text-white">{displayName}</span>
                <span className="text-slate-500 text-xs">eliminated if</span>
                <div className="flex flex-wrap gap-1">
                  {killers.map((k, i) => (
                    <span key={i} className="inline-flex items-center rounded-md bg-amber-900/30 border border-amber-800/50 px-2 py-0.5 text-xs text-amber-300 font-medium">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickLink href="/standings" title="Standings" desc="Full table with win %, max score, and status." />
        <QuickLink href="/brackets" title="Brackets" desc="Every bracket side by side — who picked what." />
        <QuickLink href="/stakes" title="Stakes" desc="Which games move the needle most for each bracket." />
        <QuickLink href="/rooting" title="Rooting Guide" desc="Who to cheer for in every remaining game." />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "blue" | "amber" | "emerald" | "red" | "slate";
}) {
  const styles = {
    blue:    { card: "border-blue-900/50 bg-blue-950/20",    val: "text-blue-300",    label: "text-blue-600" },
    amber:   { card: "border-amber-900/50 bg-amber-950/20",  val: "text-amber-300",   label: "text-amber-700" },
    emerald: { card: "border-emerald-900/50 bg-emerald-950/20", val: "text-emerald-300", label: "text-emerald-700" },
    red:     { card: "border-red-900/50 bg-red-950/20",      val: "text-red-400",     label: "text-red-700" },
    slate:   { card: "border-slate-800 bg-slate-900/40",     val: "text-slate-500",   label: "text-slate-600" },
  }[accent];

  return (
    <div className={`rounded-xl border p-4 text-center ${styles.card}`}>
      <div className={`text-3xl font-bold tabular-nums ${styles.val}`}>{value}</div>
      <div className={`text-[11px] mt-1 uppercase tracking-widest font-medium ${styles.label}`}>{label}</div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="card-hover p-5 flex flex-col gap-1 group"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white group-hover:text-blue-300 transition-colors text-sm">
          {title}
        </span>
        <span className="text-slate-600 group-hover:text-blue-400 transition-colors text-sm">→</span>
      </div>
      <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
    </Link>
  );
}
