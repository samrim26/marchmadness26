import type { Metadata } from "next";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";
import { SCORING_SETTINGS } from "@/data/settings";
import { getResults } from "@/lib/getResults";
import { PRIZE_CONFIG, parseBracketName } from "@/data/prizeConfig";
import { fetchLiveOdds, matchOddsToGames } from "@/lib/odds";
import { computePersonHedgeData } from "@/lib/hedging";
import { computeEntryProbabilities } from "@/lib/simulation";
import type { HedgeBet, PersonHedgeData } from "@/lib/types";

export const metadata: Metadata = {
  title: "Hedging Guide | March Madness 2026",
};

// Always render fresh so env vars and live odds are never stale-cached
export const dynamic = "force-dynamic";

export default async function HedgingPage() {
  const RESULTS = await getResults();
  const analytics = computeEntryProbabilities(
    ENTRIES,
    GAMES,
    RESULTS,
    SCORING_SETTINGS
  );

  // Fetch live odds
  const { odds: rawOdds, error: oddsError } = await fetchLiveOdds();
  const liveOdds = rawOdds ? matchOddsToGames(rawOdds, RESULTS) : [];
  const hasLiveOdds = liveOdds.length > 0;

  const personData = hasLiveOdds
    ? computePersonHedgeData(ENTRIES, GAMES, RESULTS, SCORING_SETTINGS, liveOdds)
    : [];

  const totalPot = PRIZE_CONFIG.totalPot;
  const anyHedgeOpportunity = personData.some((p) => p.bestHedge !== null);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Hedging Guide</h1>
        <p className="text-slate-400 mt-1">
          Lock in guaranteed profit by betting against your pool position at a
          sportsbook. Odds update every 10 minutes.
        </p>
      </div>

      {/* Prize pool summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 grid sm:grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-white">
            ${totalPot}
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">
            Total Pot
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-emerald-400">
            +${PRIZE_CONFIG.netIfFirst}
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">
            Net Profit (1st)
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-400">$0</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">
            Net Profit (2nd)
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-400">
            -${PRIZE_CONFIG.entryFeePerPerson}
          </div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">
            Net Loss (out)
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-blue-800/30 bg-blue-900/10 p-5 text-sm space-y-2">
        <div className="font-semibold text-blue-300 mb-1">
          How hedging works
        </div>
        <p className="text-slate-300">
          You paid $20 to enter. If your bracket wins, you net +$160. If it
          loses, you're down $20. A hedge bet at a sportsbook on the{" "}
          <em>opposing team</em> locks in a floor — you sacrifice some upside
          to eliminate the downside.
        </p>
        <p className="text-slate-400">
          <strong className="text-white">Formula:</strong> Bet H = (EV if your
          pick wins − EV if your pick loses) ÷ opponent's decimal odds. This
          equalises both outcomes and locks in a guaranteed floor.
        </p>
        <p className="text-slate-400">
          A hedge is worth taking when the{" "}
          <strong className="text-white">guaranteed floor &gt; $0</strong>{" "}
          (you make money no matter what).
        </p>
      </div>

      {/* No live odds — show reason */}
      {!hasLiveOdds && (
        <div className="rounded-xl border border-yellow-800/50 bg-yellow-900/10 p-5 space-y-3">
          <div className="font-semibold text-yellow-300">
            Live odds not connected
          </div>
          {oddsError && (
            <div className="rounded bg-slate-900 p-3 text-sm font-mono text-red-400">
              {oddsError.type}: {oddsError.message}
            </div>
          )}
          {oddsError?.type === "no_key" && (
            <p className="text-sm text-slate-300">
              Add <code className="text-blue-400">ODDS_API_KEY</code> to Vercel →
              Settings → Environment Variables, then redeploy.
            </p>
          )}
          {oddsError?.type === "no_games" && (
            <p className="text-sm text-slate-300">
              API key is valid but no Sweet 16 games are posted yet. Check back
              closer to tip-off — odds usually appear 24–48 hrs before games.
            </p>
          )}
          {oddsError?.type === "api_error" && (
            <p className="text-sm text-slate-300">
              Double-check the key value in Vercel environment variables matches
              exactly what the-odds-api.com shows in your account dashboard.
            </p>
          )}
          <EVOnlyTable analytics={analytics} />
        </div>
      )}

      {/* Hedge opportunities per person */}
      {hasLiveOdds && (
        <div className="space-y-6">
          {!anyHedgeOpportunity && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-400">
              No guaranteed positive-floor hedge opportunities found at current
              odds. Odds shift — check back as games approach.
            </div>
          )}

          {personData.map((person) => (
            <PersonHedgeCard key={person.personName} person={person} />
          ))}
        </div>
      )}

      {/* Upcoming games with live odds */}
      {hasLiveOdds && liveOdds.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            Live Odds — Upcoming Games
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {liveOdds
              .filter((o) => o.gameId !== null)
              .map((o) => (
                <div
                  key={o.apiMatchId}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                    {new Date(o.commenceTime).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="flex gap-3">
                    <OddsTeamCell t={o.team1} />
                    <div className="self-center text-slate-600 text-xs">vs</div>
                    <OddsTeamCell t={o.team2} />
                  </div>
                  <div className="text-xs text-slate-600 mt-2">
                    via {o.team1.bookmaker}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PersonHedgeCard({ person }: { person: PersonHedgeData }) {
  const hasOpportunity =
    person.bestHedge !== null && person.bestHedge.guaranteedFloor > 0;

  return (
    <div
      className={`rounded-xl border p-5 space-y-4 ${
        hasOpportunity
          ? "border-emerald-700/60 bg-emerald-900/10"
          : "border-slate-800 bg-slate-900/60"
      }`}
    >
      {/* Person header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="text-xl font-bold text-white">
            {person.personName}
          </div>
          <div className="text-sm text-slate-400 mt-0.5">
            Brackets:{" "}
            {person.displayNames.map((n) => {
              const { championPick } = parseBracketName(n);
              return championPick ?? n;
            }).join(" · ")}
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-lg font-bold tabular-nums ${
              person.combinedPoolEV > 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {person.combinedPoolEV >= 0 ? "+" : ""}${person.combinedPoolEV}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Expected net</div>
        </div>
      </div>

      {/* Best hedge callout */}
      {person.bestHedge && (
        <HedgeBetCard hedge={person.bestHedge} highlight={hasOpportunity} />
      )}

      {/* All hedge opportunities */}
      {person.hedgeOpportunities.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-400 hover:text-white transition-colors">
            All {person.hedgeOpportunities.length} opportunities
          </summary>
          <div className="mt-3 space-y-2">
            {person.hedgeOpportunities.slice(1).map((h, i) => (
              <HedgeBetCard key={i} hedge={h} highlight={false} compact />
            ))}
          </div>
        </details>
      )}

      {person.hedgeOpportunities.length === 0 && (
        <p className="text-sm text-slate-500">
          No hedge opportunities — no live odds matched for upcoming games.
        </p>
      )}
    </div>
  );
}

function HedgeBetCard({
  hedge,
  highlight,
  compact = false,
}: {
  hedge: HedgeBet;
  highlight: boolean;
  compact?: boolean;
}) {
  const isPositive = hedge.guaranteedFloor > 0;
  const americanStr =
    hedge.americanOdds > 0
      ? `+${hedge.americanOdds}`
      : `${hedge.americanOdds}`;

  if (compact) {
    return (
      <div className="flex items-center justify-between text-sm text-slate-400 gap-2">
        <span className="truncate">{hedge.gameLabel}</span>
        <span>
          Bet ${hedge.betAmount} on{" "}
          <span className="text-white">{hedge.betOnTeamName}</span> ({americanStr})
          → floor{" "}
          <span
            className={isPositive ? "text-emerald-400" : "text-red-400"}
          >
            {hedge.guaranteedFloor >= 0 ? "+" : ""}${hedge.guaranteedFloor}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg p-4 border ${
        highlight && isPositive
          ? "border-emerald-700/50 bg-emerald-900/20"
          : "border-slate-700/50 bg-slate-800/40"
      }`}
    >
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
        {highlight && isPositive ? "★ Best Hedge Opportunity" : "Hedge"}
      </div>
      <div className="text-sm text-slate-300 mb-3">{hedge.gameLabel}</div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="rounded bg-slate-900/60 p-2">
          <div className="text-lg font-bold text-white">
            ${hedge.betAmount}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Bet amount</div>
        </div>
        <div className="rounded bg-slate-900/60 p-2">
          <div className="text-lg font-bold text-blue-300">{americanStr}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {hedge.betOnTeamName}
          </div>
        </div>
        <div className="rounded bg-slate-900/60 p-2">
          <div
            className={`text-lg font-bold ${
              isPositive ? "text-emerald-400" : "text-orange-400"
            }`}
          >
            {hedge.guaranteedFloor >= 0 ? "+" : ""}${hedge.guaranteedFloor}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Guaranteed floor</div>
        </div>
        <div className="rounded bg-slate-900/60 p-2">
          <div
            className={`text-lg font-bold ${
              hedge.evIfNoBet >= 0 ? "text-slate-300" : "text-red-400"
            }`}
          >
            {hedge.evIfNoBet >= 0 ? "+" : ""}${hedge.evIfNoBet}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">EV without hedge</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500 space-y-0.5">
        <div>
          Pool EV if your pick wins:{" "}
          <span className="text-slate-300">
            {hedge.poolEVIfPickWins >= 0 ? "+" : ""}${hedge.poolEVIfPickWins}
          </span>
        </div>
        <div>
          Pool EV if your pick loses:{" "}
          <span className="text-slate-300">
            {hedge.poolEVIfPickLoses >= 0 ? "+" : ""}${hedge.poolEVIfPickLoses}
          </span>
        </div>
        <div className="text-slate-600 pt-1">
          via {hedge.bookmaker} · Bet{" "}
          <strong className="text-slate-400">${hedge.betAmount}</strong> on{" "}
          <strong className="text-slate-400">{hedge.betOnTeamName}</strong> at{" "}
          {americanStr} to lock in floor of{" "}
          <strong className={isPositive ? "text-emerald-400" : "text-orange-400"}>
            {hedge.guaranteedFloor >= 0 ? "+" : ""}${hedge.guaranteedFloor}
          </strong>
        </div>
      </div>
    </div>
  );
}

function OddsTeamCell({ t }: { t: import("@/lib/types").TeamOdds }) {
  const american =
    t.americanOdds > 0 ? `+${t.americanOdds}` : `${t.americanOdds}`;
  const isFav = t.americanOdds < 0;
  return (
    <div className="flex-1 rounded bg-slate-800/60 p-3 text-center">
      <div className="font-medium text-white text-sm">{t.teamName}</div>
      <div
        className={`text-lg font-bold tabular-nums mt-1 ${
          isFav ? "text-blue-300" : "text-slate-300"
        }`}
      >
        {american}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">
        {(t.impliedProbability * 100).toFixed(0)}% implied
      </div>
    </div>
  );
}

function EVOnlyTable({
  analytics,
}: {
  analytics: ReturnType<typeof computeEntryProbabilities>;
}) {
  const sorted = [...analytics].sort(
    (a, b) => b.poolEV - a.poolEV
  );
  return (
    <div className="mt-4 rounded-lg border border-slate-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-400">
              Bracket
            </th>
            <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider text-slate-400">
              Win/Tie %
            </th>
            <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider text-slate-400">
              2nd %
            </th>
            <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wider text-slate-400">
              Pool EV
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map((a) => (
            <tr
              key={a.entryId}
              className={`table-row-hover ${a.eliminated ? "opacity-50" : ""}`}
            >
              <td className="px-4 py-2.5 font-medium text-white">
                {a.displayName}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-blue-300">
                {(a.firstOrTieProbability * 100).toFixed(1)}%
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
                {(a.secondPlaceProbability * 100).toFixed(1)}%
              </td>
              <td
                className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                  a.poolEV > 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {a.poolEV >= 0 ? "+" : ""}${a.poolEV.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
