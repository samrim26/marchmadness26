"use client";

import { useState, useEffect } from "react";

// ─── Types passed from server ─────────────────────────────────────────────────

export interface SerializedGame {
  gameId: string;
  gameLabel: string;
  team1Id: string;
  team1Name: string;
  team2Id: string;
  team2Name: string;
  /** Pool EV per entry if team1 wins. Index matches entries array. */
  evsIfTeam1Wins: number[];
  /** Pool EV per entry if team2 wins. Index matches entries array. */
  evsIfTeam2Wins: number[];
}

export interface SerializedEntry {
  entryId: string;
  displayName: string;
  personName: string;
  overallPoolEV: number;
}

// ─── ESPN client-side fetch ───────────────────────────────────────────────────

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

// Broad team name normalization for ESPN names → our team IDs
const ESPN_NAME_MAP: Record<string, string> = {
  duke: "duke",
  "duke blue devils": "duke",
  "st. john's": "stjohns",
  "st john's": "stjohns",
  "st. john\u2019s": "stjohns",
  "st john\u2019s": "stjohns",
  "st. john's red storm": "stjohns",
  "st john's red storm": "stjohns",
  "michigan state": "michiganstate",
  "michigan st": "michiganstate",
  "michigan state spartans": "michiganstate",
  uconn: "uconn",
  connecticut: "uconn",
  "connecticut huskies": "uconn",
  "uconn huskies": "uconn",
  iowa: "iowa",
  "iowa hawkeyes": "iowa",
  nebraska: "nebraska",
  "nebraska cornhuskers": "nebraska",
  illinois: "illinois",
  "illinois fighting illini": "illinois",
  houston: "houston",
  "houston cougars": "houston",
  arizona: "arizona",
  "arizona wildcats": "arizona",
  arkansas: "arkansas",
  "arkansas razorbacks": "arkansas",
  texas: "texas",
  "texas longhorns": "texas",
  purdue: "purdue",
  "purdue boilermakers": "purdue",
  michigan: "michigan",
  "michigan wolverines": "michigan",
  alabama: "alabama",
  "alabama crimson tide": "alabama",
  tennessee: "tennessee",
  "tennessee volunteers": "tennessee",
  "iowa state": "iowastate",
  "iowa st": "iowastate",
  "iowa state cyclones": "iowastate",
};

function normalizeEspnName(name: string): string | null {
  return ESPN_NAME_MAP[name.toLowerCase()] ?? null;
}

function americanToDecimal(american: number): number {
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

interface ParsedOdds {
  team1Id: string;
  team2Id: string;
  team1AmericanOdds: number;
  team2AmericanOdds: number;
  team1DecimalOdds: number;
  team2DecimalOdds: number;
  bookmaker: string;
}

async function fetchEspnOddsBrowser(): Promise<ParsedOdds[]> {
  const results: ParsedOdds[] = [];
  const now = new Date();
  const dates: string[] = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`
    );
  }

  for (const date of dates) {
    try {
      const res = await fetch(
        `${ESPN_BASE}/scoreboard?dates=${date}&limit=50`,
        { cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const events: Record<string, unknown>[] = data.events ?? [];

      for (const event of events) {
        // Odds are inside competitions[0].odds[], NOT at the event level
        const comp = (event.competitions as Record<string, unknown>[])?.[0];
        if (!comp) continue;

        const oddsArr = comp.odds as Record<string, unknown>[] | undefined;
        if (!oddsArr || oddsArr.length === 0) continue;

        const oddsEntry =
          oddsArr.find((o) =>
            String((o.provider as Record<string, unknown>)?.name ?? "")
              .toLowerCase()
              .includes("draft")
          ) ??
          oddsArr.find((o) =>
            String((o.provider as Record<string, unknown>)?.name ?? "")
              .toLowerCase()
              .includes("espn")
          ) ??
          oddsArr[0];

        // moneyline.home.close.odds / moneyline.away.close.odds (strings like "-290")
        const ml = oddsEntry.moneyline as Record<string, unknown> | undefined;
        let awayML: number | null = null;
        let homeML: number | null = null;

        if (ml) {
          const away = (ml.away as Record<string, unknown> | undefined)?.close as Record<string, unknown> | undefined;
          const home = (ml.home as Record<string, unknown> | undefined)?.close as Record<string, unknown> | undefined;
          awayML = away?.odds != null ? Number(String(away.odds).replace("+", "")) : null;
          homeML = home?.odds != null ? Number(String(home.odds).replace("+", "")) : null;
        } else {
          // Fallback: numeric moneyLine field
          awayML = (oddsEntry.awayTeamOdds as Record<string, unknown> | undefined)?.moneyLine as number ?? null;
          homeML = (oddsEntry.homeTeamOdds as Record<string, unknown> | undefined)?.moneyLine as number ?? null;
        }

        if (awayML == null || isNaN(awayML) || homeML == null || isNaN(homeML)) continue;

        const competitors = comp.competitors as Record<string, unknown>[] | undefined;
        const awayComp = competitors?.find((c) => c.homeAway === "away");
        const homeComp = competitors?.find((c) => c.homeAway === "home");
        if (!awayComp || !homeComp) continue;

        const awayTeam = awayComp.team as Record<string, unknown>;
        const homeTeam = homeComp.team as Record<string, unknown>;
        const awayName = String(awayTeam.shortDisplayName || awayTeam.displayName || "");
        const homeName = String(homeTeam.shortDisplayName || homeTeam.displayName || "");

        const awayId = normalizeEspnName(awayName);
        const homeId = normalizeEspnName(homeName);
        if (!awayId || !homeId) continue;

        const bookmaker = String(
          (oddsEntry.provider as Record<string, unknown>)?.name ?? "DraftKings"
        );

        results.push({
          team1Id: awayId,
          team2Id: homeId,
          team1AmericanOdds: awayML,
          team2AmericanOdds: homeML,
          team1DecimalOdds: americanToDecimal(awayML),
          team2DecimalOdds: americanToDecimal(homeML),
          bookmaker,
        });
      }
    } catch {
      // skip date on error
    }
  }
  return results;
}

// ─── Hedge computation from pre-computed EVs ─────────────────────────────────

interface HedgeBet {
  gameLabel: string;
  betOnTeamName: string;
  betAmount: number;
  americanOdds: number;
  guaranteedFloor: number;
  evIfNoBet: number;
  poolEVIfPickWins: number;
  poolEVIfPickLoses: number;
  bookmaker: string;
}

interface PersonHedge {
  personName: string;
  displayNames: string[];
  combinedPoolEV: number;
  hedges: HedgeBet[];
  bestHedge: HedgeBet | null;
}

function computeHedges(
  games: SerializedGame[],
  entries: SerializedEntry[],
  liveOdds: ParsedOdds[]
): PersonHedge[] {
  // Group entries by person
  const personMap = new Map<string, number[]>(); // personName → entry indices
  for (let i = 0; i < entries.length; i++) {
    const name = entries[i].personName;
    if (!personMap.has(name)) personMap.set(name, []);
    personMap.get(name)!.push(i);
  }

  const result: PersonHedge[] = [];

  for (const [personName, indices] of personMap) {
    const allHedges: HedgeBet[] = [];

    for (const ei of indices) {
      const entry = entries[ei];
      for (const game of games) {
        // Match odds to this game
        const odds = liveOdds.find(
          (o) =>
            (o.team1Id === game.team1Id && o.team2Id === game.team2Id) ||
            (o.team1Id === game.team2Id && o.team2Id === game.team1Id)
        );
        if (!odds) continue;

        const ev1 = game.evsIfTeam1Wins[ei]; // EV if game.team1 wins
        const ev2 = game.evsIfTeam2Wins[ei]; // EV if game.team2 wins

        // Map game.team1/team2 to the correct odds regardless of ESPN home/away order
        const t1MatchesOddsTeam1 = odds.team1Id === game.team1Id;
        const t1Decimal  = t1MatchesOddsTeam1 ? odds.team1DecimalOdds  : odds.team2DecimalOdds;
        const t1American = t1MatchesOddsTeam1 ? odds.team1AmericanOdds : odds.team2AmericanOdds;
        const t2Decimal  = t1MatchesOddsTeam1 ? odds.team2DecimalOdds  : odds.team1DecimalOdds;
        const t2American = t1MatchesOddsTeam1 ? odds.team2AmericanOdds : odds.team1AmericanOdds;

        // Prefer the scenario with higher EV; hedge by betting on the OTHER team
        const [evIfPick, evIfOpp, oppDecimal, oppAmerican, oppName] =
          ev1 >= ev2
            ? [ev1, ev2, t2Decimal, t2American, game.team2Name] // prefer t1 → bet on t2
            : [ev2, ev1, t1Decimal, t1American, game.team1Name]; // prefer t2 → bet on t1

        const evDiff = evIfPick - evIfOpp;
        if (evDiff <= 0) continue;

        const H = evDiff / oppDecimal;
        const floor = evIfPick - H;

        allHedges.push({
          gameLabel: `${game.gameLabel} (${entry.displayName})`,
          betOnTeamName: oppName,
          betAmount: Math.max(1, Math.round(H)),
          americanOdds: oppAmerican,
          guaranteedFloor: Math.round(floor * 100) / 100,
          evIfNoBet: Math.round(((evIfPick + evIfOpp) / 2) * 100) / 100,
          poolEVIfPickWins: Math.round(evIfPick * 100) / 100,
          poolEVIfPickLoses: Math.round(evIfOpp * 100) / 100,
          bookmaker: odds.bookmaker,
        });
      }
    }

    const combinedEV = Math.round(
      indices.reduce((s, i) => s + entries[i].overallPoolEV, 0) * 100
    ) / 100;

    const bestHedge =
      allHedges.length > 0
        ? allHedges.reduce((b, h) => (h.guaranteedFloor > b.guaranteedFloor ? h : b))
        : null;

    result.push({
      personName,
      displayNames: indices.map((i) => entries[i].displayName),
      combinedPoolEV: combinedEV,
      hedges: allHedges.sort((a, b) => b.guaranteedFloor - a.guaranteedFloor),
      bestHedge,
    });
  }

  return result.sort((a, b) => b.combinedPoolEV - a.combinedPoolEV);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HedgingClient({
  games,
  entries,
}: {
  games: SerializedGame[];
  entries: SerializedEntry[];
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "no_odds" | "error">("loading");
  const [personData, setPersonData] = useState<PersonHedge[]>([]);
  const [oddsSource, setOddsSource] = useState("");

  useEffect(() => {
    fetchEspnOddsBrowser()
      .then((odds) => {
        if (odds.length === 0) {
          setStatus("no_odds");
          return;
        }
        const hedges = computeHedges(games, entries, odds);
        setPersonData(hedges);
        setOddsSource(odds[0]?.bookmaker ?? "DraftKings");
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [games, entries]);

  if (status === "loading") {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 animate-pulse">
        Loading live odds…
      </div>
    );
  }

  if (status === "no_odds") {
    return (
      <div className="rounded-xl border border-yellow-800/50 bg-yellow-900/10 p-5 space-y-2">
        <div className="font-semibold text-yellow-300">No odds posted yet</div>
        <p className="text-sm text-slate-400">
          ESPN hasn't posted moneylines for upcoming games yet. Check back closer to tip-off.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-800/40 bg-red-900/10 p-5 text-red-400 text-sm">
        Failed to load live odds. Try refreshing the page.
      </div>
    );
  }

  const positiveHedges = personData.filter((p) => p.bestHedge !== null && p.bestHedge.guaranteedFloor > 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Live odds via {oddsSource} · updates on refresh</p>

      {/* Action summary — shown when anyone has a positive hedge */}
      {positiveHedges.length > 0 && (
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/10 p-5 space-y-3">
          <div className="text-sm font-semibold text-emerald-300 uppercase tracking-wider">
            Guaranteed profit available right now
          </div>
          <div className="space-y-2">
            {positiveHedges.map((p) => {
              const h = p.bestHedge!;
              const am = h.americanOdds > 0 ? `+${h.americanOdds}` : `${h.americanOdds}`;
              return (
                <div key={p.personName} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                  <span className="font-semibold text-white">{p.personName}:</span>
                  <span className="text-slate-300">
                    Bet <span className="font-semibold text-white">${h.betAmount}</span> on{" "}
                    <span className="font-semibold text-white">{h.betOnTeamName}</span> at{" "}
                    <span className="text-blue-300">{am}</span> on {h.bookmaker}
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    → pool EV stays at +${h.guaranteedFloor} regardless of this game
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {positiveHedges.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-400">
          No guaranteed positive-floor hedge opportunities at current odds. Check back as lines move.
        </div>
      )}

      {/* Per-person detail cards */}
      {personData.map((person) => {
        const best = person.bestHedge;
        const hasOpportunity = best !== null && best.guaranteedFloor > 0;
        const americanStr = best
          ? best.americanOdds > 0 ? `+${best.americanOdds}` : `${best.americanOdds}`
          : "";

        // Without hedge: rough expected outcome (50/50 assumption)
        const withoutHedge = best ? best.evIfNoBet : null;
        // With hedge: guaranteed no matter what
        const withHedge = best ? best.guaranteedFloor : null;

        return (
          <div
            key={person.personName}
            className={`rounded-xl border p-5 space-y-4 ${
              hasOpportunity ? "border-emerald-700/60 bg-emerald-900/10" : "border-slate-800 bg-slate-900/60"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <div className="text-xl font-bold text-white">{person.personName}</div>
                <div className="text-sm text-slate-400 mt-0.5">{person.displayNames.join(" · ")}</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold tabular-nums ${person.combinedPoolEV > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {person.combinedPoolEV >= 0 ? "+" : ""}${person.combinedPoolEV}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Expected net (no hedge)</div>
              </div>
            </div>

            {best && (
              <div className={`rounded-lg border p-4 space-y-3 ${hasOpportunity ? "border-emerald-700/50 bg-emerald-900/20" : "border-slate-700/50 bg-slate-800/40"}`}>
                {/* Action line */}
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">
                    {hasOpportunity ? "★ Recommended action" : "Hedge option"}
                  </div>
                  <div className="text-base font-semibold text-white">
                    Bet <span className="text-emerald-300">${best.betAmount}</span> on{" "}
                    <span className="text-emerald-300">{best.betOnTeamName}</span>{" "}
                    <span className="text-slate-400 font-normal">at</span>{" "}
                    <span className="text-blue-300">{americanStr}</span>{" "}
                    <span className="text-slate-400 font-normal text-sm">on {best.bookmaker}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{best.gameLabel}</div>
                </div>

                {/* Two outcome comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-900/60 p-3 space-y-1">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Pool EV after hedge</div>
                    <div className={`text-2xl font-bold tabular-nums ${(withHedge ?? 0) > 0 ? "text-emerald-400" : "text-orange-400"}`}>
                      {(withHedge ?? 0) >= 0 ? "+" : ""}${withHedge}
                    </div>
                    <div className="text-xs text-slate-400">same regardless of this game</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 p-3 space-y-1">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Pool EV without hedge</div>
                    <div className={`text-2xl font-bold tabular-nums ${(withoutHedge ?? 0) >= 0 ? "text-slate-300" : "text-red-400"}`}>
                      {(withoutHedge ?? 0) >= 0 ? "+" : ""}${withoutHedge}
                    </div>
                    <div className="text-xs text-slate-400">average of two scenarios</div>
                  </div>
                </div>

                {/* Range detail */}
                <div className="text-xs text-slate-500 border-t border-slate-700/50 pt-2 space-y-0.5">
                  <div>
                    Without hedge: pool EV swings from{" "}
                    <span className="text-slate-300">{best.poolEVIfPickLoses >= 0 ? "+" : ""}${best.poolEVIfPickLoses}</span>{" "}
                    if pick loses to{" "}
                    <span className="text-slate-300">{best.poolEVIfPickWins >= 0 ? "+" : ""}${best.poolEVIfPickWins}</span>{" "}
                    if pick wins
                  </div>
                  <div>
                    With hedge: pool EV locked at{" "}
                    <span className={hasOpportunity ? "text-emerald-400" : "text-slate-300"}>{best.guaranteedFloor >= 0 ? "+" : ""}${best.guaranteedFloor}</span>{" "}
                    — remaining games still determine actual payout
                  </div>
                </div>
              </div>
            )}

            {person.hedges.length > 1 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-400 hover:text-white transition-colors">
                  All {person.hedges.length} opportunities
                </summary>
                <div className="mt-3 space-y-2">
                  {person.hedges.slice(1).map((h, i) => {
                    const am = h.americanOdds > 0 ? `+${h.americanOdds}` : `${h.americanOdds}`;
                    return (
                      <div key={i} className="flex items-center justify-between text-sm text-slate-400 gap-2">
                        <span className="truncate">{h.gameLabel}</span>
                        <span>
                          Bet ${h.betAmount} on{" "}
                          <span className="text-white">{h.betOnTeamName}</span> ({am}) → floor{" "}
                          <span className={h.guaranteedFloor > 0 ? "text-emerald-400" : "text-red-400"}>
                            {h.guaranteedFloor >= 0 ? "+" : ""}${h.guaranteedFloor}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            {person.hedges.length === 0 && (
              <p className="text-sm text-slate-500">No matching odds found for upcoming games.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
