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

type HedgeTier = "guaranteed" | "strong";

interface HedgeBet {
  gameLabel: string;
  betOnTeamName: string;
  betAmount: number;
  americanOdds: number;
  guaranteedFloor: number;
  bookmaker: string;
  pWinIfPick: number;
  pWinIfOpp: number;
  tier: HedgeTier;
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

        // Tier 1 — Guaranteed: near-certain win/loss, floor is a mathematical lock
        // Tier 2 — Strong: high probability but floor is expected value, not a lock
        const isGuaranteed = pWinIfPick > 0.90 && pWinIfOpp < 0.10;
        const isStrong     = pWinIfPick > 0.65 && pWinIfOpp < 0.25;
        if (!isGuaranteed && !isStrong) continue;

        const tier: HedgeTier = isGuaranteed ? "guaranteed" : "strong";

        // Hedge amount to equalise expected outcomes
        const H = (evIfPick - evIfOpp) / oppDecimal;
        const floor = evIfPick - H;

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
          tier,
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

// ─── HedgeCard sub-component ─────────────────────────────────────────────────

function HedgeCard({
  person,
  best,
  am,
  tier,
}: {
  person: PersonHedge;
  best: HedgeBet;
  am: string;
  tier: HedgeTier;
}) {
  const isGuaranteed = tier === "guaranteed";
  const borderCls = isGuaranteed
    ? "border-emerald-700/50 bg-emerald-900/10"
    : "border-blue-800/40 bg-blue-950/10";
  const innerBorderCls = isGuaranteed
    ? "border-emerald-700/40 bg-emerald-900/20"
    : "border-blue-800/30 bg-blue-950/20";
  const floorCls = isGuaranteed ? "text-emerald-400" : "text-blue-300";
  const floorLabel = isGuaranteed ? "guaranteed floor" : "expected floor";
  const floorDesc = isGuaranteed
    ? "No matter who wins this game, you walk away with at least this amount from the combination of your pool position and this bet."
    : "Based on current win probabilities — highly likely to be profitable, but not a mathematical lock since your pool win isn't certain yet.";

  const extraHedges = person.hedges.filter((h) => h !== best);

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${borderCls}`}>
      <div>
        <div className="text-lg font-bold text-white">{person.personName}</div>
        <div className="text-xs text-slate-500 mt-0.5">{person.displayNames.join(" · ")}</div>
      </div>

      <div className={`rounded-lg border p-4 space-y-3 ${innerBorderCls}`}>
        <div className="text-[11px] text-slate-500 uppercase tracking-wider">{floorLabel} hedge</div>

        <div className="text-base font-semibold text-white">
          Bet <span className={floorCls}>${best.betAmount}</span> on{" "}
          <span className={floorCls}>{best.betOnTeamName}</span>{" "}
          <span className="text-slate-400 font-normal">at</span>{" "}
          <span className="text-blue-300">{am}</span>{" "}
          <span className="text-slate-400 font-normal text-sm">on {best.bookmaker}</span>
        </div>
        <div className="text-xs text-slate-600">{best.gameLabel}</div>

        <div className={`rounded-md border px-4 py-3 ${isGuaranteed ? "bg-emerald-900/40 border-emerald-700/40" : "bg-blue-900/20 border-blue-800/30"}`}>
          <div className={`text-2xl font-bold ${floorCls}`}>
            +${best.guaranteedFloor} {floorLabel}
          </div>
          <div className="text-sm text-slate-400 mt-1">{floorDesc}</div>
        </div>

        <div className="text-xs text-slate-500 space-y-0.5 border-t border-slate-700/40 pt-2">
          <div>
            If your pick wins: {(best.pWinIfPick * 100).toFixed(0)}% chance to win the pool → bet is a small loss.
          </div>
          <div>
            If {best.betOnTeamName} wins: {(best.pWinIfOpp * 100).toFixed(0)}% chance to win the pool → sportsbook payout compensates.
          </div>
        </div>
      </div>

      {extraHedges.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-400 hover:text-white transition-colors">
            {extraHedges.length} more hedge{extraHedges.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-3 space-y-2">
            {extraHedges.map((h, i) => {
              const a = h.americanOdds > 0 ? `+${h.americanOdds}` : `${h.americanOdds}`;
              const label = h.tier === "guaranteed" ? "guaranteed" : "expected floor";
              return (
                <div key={i} className="flex items-center justify-between text-sm text-slate-400 gap-2">
                  <span className="truncate">{h.gameLabel}</span>
                  <span className="shrink-0">
                    Bet ${h.betAmount} on <span className="text-white">{h.betOnTeamName}</span> ({a}) →{" "}
                    <span className={h.tier === "guaranteed" ? "text-emerald-400" : "text-blue-400"}>
                      +${h.guaranteedFloor} {label}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
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

  const guaranteed = personData.filter((p) => p.hedges.some((h) => h.tier === "guaranteed"));
  const strongOnly = personData
    .map((p) => ({ ...p, hedges: p.hedges.filter((h) => h.tier === "strong") }))
    .filter((p) => p.hedges.length > 0 && !guaranteed.find((g) => g.personName === p.personName));

  return (
    <div className="space-y-8">
      <p className="text-xs text-slate-500">Live odds via {oddsSource} · updates on refresh</p>

      {/* ── Guaranteed tier ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Guaranteed</h2>
          <div className="flex-1 h-px bg-slate-800/60" />
          <span className="text-[11px] text-slate-600">pWin &gt; 90% if pick wins · &lt; 10% if opp wins</span>
        </div>

        {guaranteed.length === 0 ? (
          <div className="card p-6 text-center space-y-1.5">
            <div className="text-slate-400 font-medium text-sm">No guaranteed hedges right now</div>
            <p className="text-xs text-slate-600">
              Needs one game to nearly lock first place (&gt;90%) and near-certain elimination if it goes the other way (&lt;10%).
            </p>
          </div>
        ) : (
          guaranteed.map((person) => {
            const best = person.hedges.filter((h) => h.tier === "guaranteed")[0];
            const am = best.americanOdds > 0 ? `+${best.americanOdds}` : `${best.americanOdds}`;
            return (
              <HedgeCard
                key={person.personName}
                person={person}
                best={best}
                am={am}
                tier="guaranteed"
              />
            );
          })
        )}
      </section>

      {/* ── Strong opportunity tier ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Strong Opportunity</h2>
          <div className="flex-1 h-px bg-slate-800/60" />
          <span className="text-[11px] text-slate-600">pWin &gt; 65% if pick wins · &lt; 25% if opp wins</span>
        </div>
        <div className="rounded-lg border border-blue-900/40 bg-blue-950/10 px-4 py-2.5 text-xs text-blue-400">
          The floor here is an <span className="font-semibold">expected value</span>, not a mathematical lock — your pick winning this game still doesn&apos;t guarantee a pool win, but the bet is very likely profitable.
        </div>

        {strongOnly.length === 0 ? (
          <div className="card p-6 text-center space-y-1.5">
            <div className="text-slate-400 font-medium text-sm">No strong hedge opportunities right now</div>
            <p className="text-xs text-slate-600">
              Needs one game to meaningfully separate a bracket's fortunes (&gt;65% / &lt;25%).
            </p>
          </div>
        ) : (
          strongOnly.map((person) => {
            const best = person.hedges[0];
            const am = best.americanOdds > 0 ? `+${best.americanOdds}` : `${best.americanOdds}`;
            return (
              <HedgeCard
                key={person.personName}
                person={person}
                best={best}
                am={am}
                tier="strong"
              />
            );
          })
        )}
      </section>
    </div>
  );
}
