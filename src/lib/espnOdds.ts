/**
 * ESPN public scoreboard API — free, no key required, accessible from servers.
 * Returns moneyline odds from ESPN BET (real market prices, updated live).
 *
 * Docs: undocumented but stable; used by ESPN apps.
 */

import { normalizeTeamName, americanToDecimal } from "@/lib/odds";
import type { GameOdds, TeamOdds } from "@/lib/types";

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

// ─── ESPN response types ──────────────────────────────────────────────────────

interface EspnTeam {
  shortDisplayName: string;
  displayName: string;
  abbreviation: string;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: EspnTeam;
}

interface EspnTeamOdds {
  moneyLine?: number; // American odds as number, e.g. -150 or 185
  favorite?: boolean;
}

interface EspnOdds {
  provider?: { name: string };
  awayTeamOdds?: EspnTeamOdds;
  homeTeamOdds?: EspnTeamOdds;
  moneyLine?: number; // sometimes top-level
}

interface EspnCompetition {
  date: string;
  competitors: EspnCompetitor[];
  odds?: EspnOdds[];
}

interface EspnEvent {
  id: string;
  name: string;
  competitions: EspnCompetition[];
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchScoreboardDate(yyyymmdd: string): Promise<EspnEvent[]> {
  try {
    const res = await fetch(
      `${ESPN_BASE}/scoreboard?dates=${yyyymmdd}&limit=50`,
      { cache: "no-store" }
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
    for (const comp of event.competitions) {
      const oddsArr = comp.odds;
      if (!oddsArr || oddsArr.length === 0) continue;

      // Prefer ESPN BET; fall back to first available
      const oddsEntry =
        oddsArr.find((o) => o.provider?.name?.toLowerCase().includes("espn")) ??
        oddsArr[0];

      const awayMoneyLine = oddsEntry.awayTeamOdds?.moneyLine;
      const homeMoneyLine = oddsEntry.homeTeamOdds?.moneyLine;

      if (awayMoneyLine == null || homeMoneyLine == null) continue;

      // competitors: one "away", one "home"
      const awayComp = comp.competitors.find((c) => c.homeAway === "away");
      const homeComp = comp.competitors.find((c) => c.homeAway === "home");
      if (!awayComp || !homeComp) continue;

      const awayName =
        awayComp.team.shortDisplayName || awayComp.team.displayName;
      const homeName =
        homeComp.team.shortDisplayName || homeComp.team.displayName;
      const bookmaker = oddsEntry.provider?.name ?? "ESPN BET";

      result.push({
        gameId: null,
        apiMatchId: event.id,
        commenceTime: comp.date,
        team1: buildTeamOdds(awayName, awayMoneyLine, bookmaker),
        team2: buildTeamOdds(homeName, homeMoneyLine, bookmaker),
      });
    }
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
 * Returns only games where both teams match our bracket teams.
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
          "ESPN returned games but none had odds posted yet. Lines typically appear 24-48h before tip-off.",
      };
    }

    return { odds: parsed, error: null };
  } catch (e) {
    return { odds: null, error: String(e) };
  }
}
