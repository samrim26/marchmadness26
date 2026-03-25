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
        const oddsArr = event.odds as Record<string, unknown>[] | undefined;
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

        // New moneyline structure
        const ml = oddsEntry.moneyline as Record<string, unknown> | undefined;
        let awayML: number | null = null;
        let homeML: number | null = null;

        if (ml) {
          const away = (ml.away as Record<string, unknown> | undefined)?.close as Record<string, unknown> | undefined;
          const home = (ml.home as Record<string, unknown> | undefined)?.close as Record<string, unknown> | undefined;
          awayML = away?.odds != null ? Number(String(away.odds).replace("+", "")) : null;
          homeML = home?.odds != null ? Number(String(home.odds).replace("+", "")) : null;
        } else {
          // Fallback: old structure
          awayML = (oddsEntry.awayTeamOdds as Record<string, unknown> | undefined)?.moneyLine as number ?? null;
          homeML = (oddsEntry.homeTeamOdds as Record<string, unknown> | undefined)?.moneyLine as number ?? null;
        }

        if (awayML == null || isNaN(awayML) || homeML == null || isNaN(homeML)) continue;

        const comp = (event.competitions as Record<string, unknown>[])?.[0];
        if (!comp) continue;
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

        // Align odds with game team order
        let ev1 = game.evsIfTeam1Wins[ei];
        let ev2 = game.evsIfTeam2Wins[ei];
        let opp1Decimal = odds.team2DecimalOdds; // bet on team2 if team1 wins is preferred
        let opp2Decimal = odds.team1DecimalOdds;
        let opp1American = odds.team2AmericanOdds;
        let opp2American = odds.team1AmericanOdds;
        let opp1Name = game.team2Name;
        let opp2Name = game.team1Name;

        // If odds are reversed (team1 in odds = team2 in game), swap
        if (odds.team1Id === game.team2Id) {
          [ev1, ev2] = [ev2, ev1];
          [opp1Decimal, opp2Decimal] = [opp2Decimal, opp1Decimal];
          [opp1American, opp2American] = [opp2American, opp1American];
          [opp1Name, opp2Name] = [opp2Name, opp1Name];
        }

        // Determine which scenario is preferred
        const [evIfPick, evIfOpp, oppDecimal, oppAmerican, oppName] =
          ev1 >= ev2
            ? [ev1, ev2, opp1Decimal, opp1American, opp1Name]
            : [ev2, ev1, opp2Decimal, opp2American, opp2Name];

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

  const anyHedge = personData.some((p) => p.bestHedge !== null && p.bestHedge.guaranteedFloor > 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">· Odds via {oddsSource}</p>

      {!anyHedge && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-400">
          No guaranteed positive-floor hedge opportunities at current odds. Check back as lines move.
        </div>
      )}

      {personData.map((person) => {
        const best = person.bestHedge;
        const hasOpportunity = best !== null && best.guaranteedFloor > 0;
        const americanStr = best
          ? best.americanOdds > 0
            ? `+${best.americanOdds}`
            : `${best.americanOdds}`
          : "";

        return (
          <div
            key={person.personName}
            className={`rounded-xl border p-5 space-y-4 ${
              hasOpportunity
                ? "border-emerald-700/60 bg-emerald-900/10"
                : "border-slate-800 bg-slate-900/60"
            }`}
          >
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <div className="text-xl font-bold text-white">{person.personName}</div>
                <div className="text-sm text-slate-400 mt-0.5">
                  {person.displayNames.join(" · ")}
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

            {best && (
              <div
                className={`rounded-lg p-4 border ${
                  hasOpportunity
                    ? "border-emerald-700/50 bg-emerald-900/20"
                    : "border-slate-700/50 bg-slate-800/40"
                }`}
              >
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  {hasOpportunity ? "★ Best Hedge Opportunity" : "Hedge"}
                </div>
                <div className="text-sm text-slate-300 mb-3">{best.gameLabel}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded bg-slate-900/60 p-2">
                    <div className="text-lg font-bold text-white">${best.betAmount}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Bet amount</div>
                  </div>
                  <div className="rounded bg-slate-900/60 p-2">
                    <div className="text-lg font-bold text-blue-300">{americanStr}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{best.betOnTeamName}</div>
                  </div>
                  <div className="rounded bg-slate-900/60 p-2">
                    <div
                      className={`text-lg font-bold ${
                        best.guaranteedFloor > 0 ? "text-emerald-400" : "text-orange-400"
                      }`}
                    >
                      {best.guaranteedFloor >= 0 ? "+" : ""}${best.guaranteedFloor}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Guaranteed floor</div>
                  </div>
                  <div className="rounded bg-slate-900/60 p-2">
                    <div
                      className={`text-lg font-bold ${
                        best.evIfNoBet >= 0 ? "text-slate-300" : "text-red-400"
                      }`}
                    >
                      {best.evIfNoBet >= 0 ? "+" : ""}${best.evIfNoBet}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">EV without hedge</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500 space-y-0.5">
                  <div>
                    Pool EV if pick wins:{" "}
                    <span className="text-slate-300">
                      {best.poolEVIfPickWins >= 0 ? "+" : ""}${best.poolEVIfPickWins}
                    </span>
                  </div>
                  <div>
                    Pool EV if pick loses:{" "}
                    <span className="text-slate-300">
                      {best.poolEVIfPickLoses >= 0 ? "+" : ""}${best.poolEVIfPickLoses}
                    </span>
                  </div>
                  <div className="text-slate-600 pt-1">
                    via {best.bookmaker} · Bet ${best.betAmount} on {best.betOnTeamName} at {americanStr}
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
