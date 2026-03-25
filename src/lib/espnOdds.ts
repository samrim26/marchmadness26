/**
 * ESPN public scoreboard API — free, no key required, accessible from servers.
 * Returns moneyline odds from DraftKings via ESPN's scoreboard JSON.
 *
 * Actual response structure (verified 2026-03-25):
 *   events[i].odds[j].moneyline.home.close.odds  → string e.g. "-290"
 *   events[i].odds[j].moneyline.away.close.odds  → string e.g. "+235"
 *   events[i].competitions[0].competitors[]      → home/away team names
 */

import { normalizeTeamName, americanToDecimal } from "@/lib/odds";
import type { GameOdds, TeamOdds } from "@/lib/types";

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

// ─── ESPN response types ──────────────────────────────────────────────────────

interface EspnTeam {
  shortDisplayName: string;
  displayName: string;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: EspnTeam;
}

interface EspnMoneylineSide {
  close?: { odds?: string };
  current?: { odds?: string };
}

interface EspnEventOdds {
  provider?: { name: string };
  moneyline?: {
    home?: EspnMoneylineSide;
    away?: EspnMoneylineSide;
  };
  // older/alternate structure some events still use
  awayTeamOdds?: { moneyLine?: number };
  homeTeamOdds?: { moneyLine?: number };
}

interface EspnCompetition {
  date: string;
  competitors: EspnCompetitor[];
  // odds live inside competitions[], not at the event level
  odds?: EspnEventOdds[];
}

interface EspnEvent {
  id: string;
  competitions: EspnCompetition[];
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.espn.com/",
  Origin: "https://www.espn.com",
};

async function fetchScoreboardDate(yyyymmdd: string): Promise<EspnEvent[]> {
  try {
    const res = await fetch(
      `${ESPN_BASE}/scoreboard?dates=${yyyymmdd}&limit=50`,
      { cache: "no-store", headers: BROWSER_HEADERS }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events as EspnEvent[]) ?? [];
  } catch {
    return [];
  }
}

/** Generate YYYYMMDD strings for the next N days starting from today. */
function upcomingDates(days = 20): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${y}${m}${day}`);
  }
  return dates;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/** Parse American odds string like "-290" or "+235" → number */
function parseAmericanOddsString(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace("+", ""));
  return isNaN(n) ? null : n;
}

function buildTeamOdds(
  apiName: string,
  americanOdds: number,
  bookmaker: string
): TeamOdds {
  const teamId = normalizeTeamName(apiName) ?? apiName;
  const decimal = americanToDecimal(americanOdds);
  return {
    teamId,
    teamName: apiName,
    decimalOdds: decimal,
    americanOdds,
    impliedProbability: 1 / decimal,
    bookmaker,
  };
}

function parseEvents(events: EspnEvent[]): GameOdds[] {
  const result: GameOdds[] = [];

  for (const event of events) {
    const comp = event.competitions[0];
    if (!comp) continue;

    // Odds are inside competitions[0].odds[], not at the event level
    const oddsArr = comp.odds;
    if (!oddsArr || oddsArr.length === 0) continue;

    // Prefer DraftKings → ESPN BET → first available
    const oddsEntry =
      oddsArr.find((o) => o.provider?.name?.toLowerCase().includes("draft")) ??
      oddsArr.find((o) => o.provider?.name?.toLowerCase().includes("espn")) ??
      oddsArr[0];

    // Try moneyline.home/away.close.odds (string) first, fall back to numeric moneyLine
    let awayML: number | null = null;
    let homeML: number | null = null;

    if (oddsEntry.moneyline) {
      awayML =
        parseAmericanOddsString(oddsEntry.moneyline.away?.close?.odds) ??
        parseAmericanOddsString(oddsEntry.moneyline.away?.current?.odds);
      homeML =
        parseAmericanOddsString(oddsEntry.moneyline.home?.close?.odds) ??
        parseAmericanOddsString(oddsEntry.moneyline.home?.current?.odds);
    } else {
      awayML = oddsEntry.awayTeamOdds?.moneyLine ?? null;
      homeML = oddsEntry.homeTeamOdds?.moneyLine ?? null;
    }

    if (awayML == null || homeML == null) continue;

    const awayComp = comp.competitors.find((c) => c.homeAway === "away");
    const homeComp = comp.competitors.find((c) => c.homeAway === "home");
    if (!awayComp || !homeComp) continue;

    const awayName = awayComp.team.shortDisplayName || awayComp.team.displayName;
    const homeName = homeComp.team.shortDisplayName || homeComp.team.displayName;
    const bookmaker = oddsEntry.provider?.name ?? "DraftKings";

    result.push({
      gameId: null,
      apiMatchId: event.id,
      commenceTime: comp.date,
      team1: buildTeamOdds(awayName, awayML, bookmaker),
      team2: buildTeamOdds(homeName, homeML, bookmaker),
    });
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface EspnOddsResult {
  odds: GameOdds[] | null;
  error: string | null;
}

/**
 * Fetch upcoming NCAAB moneylines from ESPN's public scoreboard API.
 * Scans the next 20 days to cover Sweet 16 → Championship.
 */
export async function fetchEspnOdds(): Promise<EspnOddsResult> {
  try {
    const dates = upcomingDates(20);

    // Fetch all dates in parallel
    const eventArrays = await Promise.all(dates.map(fetchScoreboardDate));
    const allEvents = eventArrays.flat();

    if (allEvents.length === 0) {
      return { odds: null, error: "ESPN returned no upcoming games." };
    }

    const parsed = parseEvents(allEvents);

    if (parsed.length === 0) {
      return {
        odds: [],
        error:
          "ESPN returned games but moneyline odds aren't posted yet. Check back closer to tip-off.",
      };
    }

    return { odds: parsed, error: null };
  } catch (e) {
    return { odds: null, error: String(e) };
  }
}
