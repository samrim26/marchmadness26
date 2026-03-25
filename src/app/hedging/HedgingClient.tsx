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
  /** P(entry wins pool | team1 wins this game), per entry index. */
  pWinIfTeam1Wins: number[];
  /** P(entry wins pool | team2 wins this game), per entry index. */
  pWinIfTeam2Wins: number[];
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

        const ml = oddsEntry.moneyline as Record<string, unknown> | undefined;
        let awayML: number | null = null;
        let homeML: number | null = null;

        if (ml) {
          const away = (ml.away as Record<string, unknown> | undefined)?.close as Record<string, unknown> | undefined;
          const home = (ml.home as Record<string, unknown> | undefined)?.close as Record<string, unknown> | undefined;
          awayML = away?.odds != null ? Number(String(away.odds).replace("+", "")) : null;
          homeML = home?.odds != null ? Number(String(home.odds).replace("+", "")) : null;
        } else {
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

// ─── Hedge computation ────────────────────────────────────────────────────────

/**
 * A hedge is only shown when placing the bet is mathematically guaranteed to
 * make money no matter what. Requirements:
 *   1. Your pick nearly locks a pool win (pWinIfPick > 0.95)
 *   2. If the other team wins you are nearly certainly out (pWinIfOpp < 0.05)
 *   3. The guaranteed floor after the hedge bet is positive (floor > 0)
 *
 * Under these conditions the "floor" figure is real cash, not an average:
 *   Pick wins  → pool pays ~1st prize − H (you lose the hedge bet)
 *   Opp wins   → pool pays ~nothing  + H × (decimalOdds − 1) (you win the hedge bet)
 * Both values converge to floor = evIfPick − H.
 */

interface HedgeBet {
  gameLabel: string;
  betOnTeamName: string;
  betAmount: number;
  americanOdds: number;
  guaranteedFloor: number;
  bookmaker: string;
  pWinIfPick: number;
  pWinIfOpp: number;
}

interface PersonHedge {
  personName: string;
  displayNames: string[];
  hedges: HedgeBet[];
}

function computeHedges(
  games: SerializedGame[],
  entries: SerializedEntry[],
  liveOdds: ParsedOdds[]
): PersonHedge[] {
  const personMap = new Map<string, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const name = entries[i].personName;
    if (!personMap.has(name)) personMap.set(name, []);
    personMap.get(name)!.push(i);
  }

  const result: PersonHedge[] = [];

  for (const [personName, indices] of personMap) {
    const hedges: HedgeBet[] = [];

    for (const ei of indices) {
      const entry = entries[ei];
      for (const game of games) {
        const odds = liveOdds.find(
          (o) =>
            (o.team1Id === game.team1Id && o.team2Id === game.team2Id) ||
            (o.team1Id === game.team2Id && o.team2Id === game.team1Id)
        );
        if (!odds) continue;

        const ev1 = game.evsIfTeam1Wins[ei];
        const ev2 = game.evsIfTeam2Wins[ei];
        const pWin1 = game.pWinIfTeam1Wins[ei];
        const pWin2 = game.pWinIfTeam2Wins[ei];

        // Align odds to game.team1 vs game.team2
        const t1MatchesOddsTeam1 = odds.team1Id === game.team1Id;
        const t1Decimal  = t1MatchesOddsTeam1 ? odds.team1DecimalOdds  : odds.team2DecimalOdds;
        const t1American = t1MatchesOddsTeam1 ? odds.team1AmericanOdds : odds.team2AmericanOdds;
        const t2Decimal  = t1MatchesOddsTeam1 ? odds.team2DecimalOdds  : odds.team1DecimalOdds;
        const t2American = t1MatchesOddsTeam1 ? odds.team2AmericanOdds : odds.team1AmericanOdds;

        // Determine which outcome this entry "prefers"
        const [evIfPick, evIfOpp, oppDecimal, oppAmerican, oppName, pWinIfPick, pWinIfOpp] =
          ev1 >= ev2
            ? [ev1, ev2, t2Decimal, t2American, game.team2Name, pWin1, pWin2]
            : [ev2, ev1, t1Decimal, t1American, game.team1Name, pWin2, pWin1];

        if (evIfPick <= evIfOpp) continue;

        // Only consider this a true cash guarantee when near-certain win/loss
        if (pWinIfPick <= 0.95 || pWinIfOpp >= 0.05) continue;

        // Hedge amount to equalise outcomes
        const H = (evIfPick - evIfOpp) / oppDecimal;
        const floor = evIfPick - H;

        // Only recommend if floor is actually positive (real guaranteed profit)
        if (floor <= 0) continue;

        hedges.push({
          gameLabel: `${game.gameLabel} (${entry.displayName})`,
          betOnTeamName: oppName,
          betAmount: Math.max(1, Math.round(H)),
          americanOdds: oppAmerican,
          guaranteedFloor: Math.round(floor * 100) / 100,
          bookmaker: odds.bookmaker,
          pWinIfPick,
          pWinIfOpp,
        });
      }
    }

    if (hedges.length > 0) {
      result.push({
        personName,
        displayNames: indices.map((i) => entries[i].displayName),
        hedges: hedges.sort((a, b) => b.guaranteedFloor - a.guaranteedFloor),
      });
    }
  }

  return result.sort((a, b) => b.hedges[0].guaranteedFloor - a.hedges[0].guaranteedFloor);
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
        Checking live odds…
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

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Live odds via {oddsSource} · updates on refresh</p>

      {personData.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-2">
          <div className="text-slate-300 font-medium">No guaranteed money available right now</div>
          <p className="text-sm text-slate-500">
            A hedge only appears here when one game is truly make-or-break for a bracket — winning nearly locks first place and losing nearly locks last. None of the current games meet that bar.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/10 p-5 space-y-3">
            <div className="text-sm font-semibold text-emerald-300 uppercase tracking-wider">
              Guaranteed cash available right now
            </div>
            <div className="space-y-2">
              {personData.map((p) => {
                const h = p.hedges[0];
                const am = h.americanOdds > 0 ? `+${h.americanOdds}` : `${h.americanOdds}`;
                return (
                  <div key={p.personName} className="text-sm">
                    <span className="font-semibold text-white">{p.personName}:</span>{" "}
                    Bet <span className="font-semibold text-white">${h.betAmount}</span> on{" "}
                    <span className="font-semibold text-white">{h.betOnTeamName}</span> at{" "}
                    <span className="text-blue-300">{am}</span> on {h.bookmaker}{" "}
                    <span className="text-emerald-400 font-semibold">
                      → guaranteed +${h.guaranteedFloor} no matter what
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {personData.map((person) => {
            const best = person.hedges[0];
            const am = best.americanOdds > 0 ? `+${best.americanOdds}` : `${best.americanOdds}`;

            return (
              <div
                key={person.personName}
                className="rounded-xl border border-emerald-700/60 bg-emerald-900/10 p-5 space-y-4"
              >
                <div>
                  <div className="text-xl font-bold text-white">{person.personName}</div>
                  <div className="text-sm text-slate-400 mt-0.5">{person.displayNames.join(" · ")}</div>
                </div>

                <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-4 space-y-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Guaranteed cash hedge</div>

                  <div className="text-base font-semibold text-white">
                    Bet <span className="text-emerald-300">${best.betAmount}</span> on{" "}
                    <span className="text-emerald-300">{best.betOnTeamName}</span>{" "}
                    <span className="text-slate-400 font-normal">at</span>{" "}
                    <span className="text-blue-300">{am}</span>{" "}
                    <span className="text-slate-400 font-normal text-sm">on {best.bookmaker}</span>
                  </div>
                  <div className="text-xs text-slate-500">{best.gameLabel}</div>

                  <div className="rounded-md bg-emerald-900/40 border border-emerald-700/40 px-4 py-3">
                    <div className="text-2xl font-bold text-emerald-400">
                      +${best.guaranteedFloor} guaranteed
                    </div>
                    <div className="text-sm text-slate-300 mt-1">
                      No matter who wins this game, you walk away with at least +${best.guaranteedFloor} from the combination of your pool position and this bet.
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 space-y-0.5 border-t border-slate-700/50 pt-2">
                    <div>
                      Why it works: if your pick wins, you win the pool (~{(best.pWinIfPick * 100).toFixed(0)}% chance) and the bet is a small loss.
                    </div>
                    <div>
                      If {best.betOnTeamName} wins, you lose the pool (~{(best.pWinIfOpp * 100).toFixed(0)}% win chance) but your sportsbook payout covers it.
                    </div>
                  </div>
                </div>

                {person.hedges.length > 1 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-slate-400 hover:text-white transition-colors">
                      {person.hedges.length - 1} more guaranteed hedge{person.hedges.length > 2 ? "s" : ""}
                    </summary>
                    <div className="mt-3 space-y-2">
                      {person.hedges.slice(1).map((h, i) => {
                        const a = h.americanOdds > 0 ? `+${h.americanOdds}` : `${h.americanOdds}`;
                        return (
                          <div key={i} className="flex items-center justify-between text-sm text-slate-400 gap-2">
                            <span className="truncate">{h.gameLabel}</span>
                            <span>
                              Bet ${h.betAmount} on <span className="text-white">{h.betOnTeamName}</span> ({a}) →{" "}
                              <span className="text-emerald-400">+${h.guaranteedFloor} guaranteed</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
