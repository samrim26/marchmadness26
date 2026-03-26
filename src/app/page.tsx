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
import { GameCard } from "@/components/GameCard";

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
  const upcoming = getGamesWithKnownParticipants(GAMES, RESULTS).slice(0, 4);

  // Find alive brackets that would be eliminated by a single game result
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

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center space-y-2 py-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          2026 March Madness
          <span className="block text-blue-400">Bracket Odds Tracker</span>
        </h1>
        <p className="text-slate-400 text-lg">
          {ENTRIES.length} brackets · exact probability engine · live updates
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Brackets" value={ENTRIES.length.toString()} />
        <StatCard label="Games Remaining" value={remaining.length.toString()} />
        <StatCard label="Still Alive" value={alive.toString()} />
        <StatCard
          label="Eliminated"
          value={eliminated.toString()}
          dim={eliminated === 0}
        />
      </div>

      {/* Leaders */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
            Current Leader
          </div>
          {leader ? (
            <>
              <div className="text-2xl font-bold text-white">
                {leader.displayName}
              </div>
              <div className="text-slate-400 mt-1">
                {leader.currentScore} pts · max {leader.maxPossibleScore}
              </div>
            </>
          ) : (
            <div className="text-slate-400">No data</div>
          )}
        </div>

        <div className="rounded-xl border border-blue-800/50 bg-blue-900/20 p-5">
          <div className="text-xs uppercase tracking-wider text-blue-500 mb-1">
            Most Likely to Win
          </div>
          {mostLikely && !mostLikely.eliminated ? (
            <>
              <div className="text-2xl font-bold text-white">
                {mostLikely.displayName}
              </div>
              <div className="text-slate-400 mt-1">
                {formatPercent(mostLikely.firstOrTieProbability)} first-or-tie
                chance
              </div>
            </>
          ) : (
            <div className="text-slate-400">—</div>
          )}
        </div>
      </div>

      {/* Upcoming games — most live content first */}
      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Next Games</h2>
            <Link href="/stakes" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              See stakes →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {upcoming.map((g) => (
              <GameCard key={g.id} game={g} results={RESULTS} />
            ))}
          </div>
        </div>
      )}

      {/* Standings — top 5 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Standings</h2>
          <Link href="/standings" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            Full table →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Entry</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Pts</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Win/Tie %</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {[...analytics]
                .sort((a, b) => b.firstOrTieProbability - a.firstOrTieProbability || b.currentScore - a.currentScore || a.displayName.localeCompare(b.displayName))
                .slice(0, 5)
                .map((a) => (
                  <tr key={a.entryId} className={`table-row-hover ${a.eliminated ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-white">
                      <Link href={`/path/${a.entryId}`} className="hover:text-blue-300 transition-colors">
                        {a.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{a.currentScore}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-300">{formatPercent(a.firstOrTieProbability)}</td>
                    <td className="px-4 py-2.5"><StatusBadge analytics={a} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 bg-slate-900/50 border-t border-slate-800 text-center">
            <Link href="/standings" className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
              View all {analytics.length} brackets →
            </Link>
          </div>
        </div>
      </div>

      {/* On the bubble */}
      {bubbleEntries.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">On the Bubble</h2>
          <div className="rounded-xl border border-orange-800/40 bg-orange-900/10 divide-y divide-orange-900/30">
            {bubbleEntries.map(({ displayName, killers }) => (
              <div key={displayName} className="px-4 py-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="font-semibold text-white">{displayName}</span>
                <span className="text-slate-400">eliminated if</span>
                <span className="text-orange-300">{killers.join(" or ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickLink href="/standings" icon="📊" title="Standings" desc="Full table with win %, max possible, and status." />
        <QuickLink href="/brackets" icon="🗂️" title="Brackets" desc="Every bracket side by side — see who picked what." />
        <QuickLink href="/stakes" icon="📈" title="Stakes" desc="Which games move the needle most for each bracket." />
        <QuickLink href="/rooting" icon="📣" title="Rooting Guide" desc="Who to cheer for in every remaining game." />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  dim,
}: {
  label: string;
  value: string;
  dim?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
      <div className={`text-3xl font-bold ${dim ? "text-slate-500" : "text-white"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-600 hover:bg-slate-900/80 transition-all group"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-semibold text-white group-hover:text-blue-300 transition-colors">
        {title}
      </div>
      <div className="text-sm text-slate-400 mt-1">{desc}</div>
    </Link>
  );
}
