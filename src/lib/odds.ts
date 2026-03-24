import type { GameOdds, TeamOdds } from "@/lib/types";

/**
 * Live odds powered by The Odds API (https://the-odds-api.com).
 * Free tier: 500 requests/month.
 *
 * To enable: add ODDS_API_KEY to .env.local
 * Results are cached for 10 minutes via Next.js fetch cache.
 */

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

// ─── Team name normalization ──────────────────────────────────────────────────
// The Odds API uses full official names; we use short IDs.
const TEAM_NAME_MAP: Record<string, string[]> = {
  duke: ["Duke", "Duke Blue Devils"],
  stjohns: ["St. John's", "St John's", "St. John's Red Storm", "St Johns"],
  michiganstate: ["Michigan State", "Michigan State Spartans"],
  uconn: ["Connecticut", "UConn", "Connecticut Huskies"],
  iowa: ["Iowa", "Iowa Hawkeyes"],
  nebraska: ["Nebraska", "Nebraska Cornhuskers"],
  illinois: ["Illinois", "Illinois Fighting Illini"],
  houston: ["Houston", "Houston Cougars"],
  arizona: ["Arizona", "Arizona Wildcats"],
  arkansas: ["Arkansas", "Arkansas Razorbacks"],
  texas: ["Texas", "Texas Longhorns"],
  purdue: ["Purdue", "Purdue Boilermakers"],
  michigan: ["Michigan", "Michigan Wolverines"],
  alabama: ["Alabama", "Alabama Crimson Tide"],
  tennessee: ["Tennessee", "Tennessee Volunteers"],
  iowastate: ["Iowa State", "Iowa State Cyclones"],
};

// Reverse map: "Duke Blue Devils" → "duke"
const REVERSE_MAP: Record<string, string> = {};
for (const [id, names] of Object.entries(TEAM_NAME_MAP)) {
  for (const name of names) {
    REVERSE_MAP[name.toLowerCase()] = id;
  }
}

export function normalizeTeamName(apiName: string): string | null {
  return REVERSE_MAP[apiName.toLowerCase()] ?? null;
}

// ─── American ↔ Decimal conversion ───────────────────────────────────────────

export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

export function americanToDecimal(american: number): number {
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

// ─── API response types ───────────────────────────────────────────────────────

interface OddsApiOutcome {
  name: string;
  price: number; // decimal odds
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: {
    key: string;
    outcomes: OddsApiOutcome[];
  }[];
}

interface OddsApiGame {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

// ─── Fetching ─────────────────────────────────────────────────────────────────

export interface OddsError {
  type: "no_key" | "api_error" | "no_games" | "parse_error";
  message: string;
  status?: number;
}

/**
 * Fetch live moneyline odds for all upcoming NCAAB games.
 * Returns { odds, error } — error is set when something went wrong.
 */
export async function fetchLiveOdds(): Promise<{
  odds: GameOdds[] | null;
  error: OddsError | null;
}> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return { odds: null, error: { type: "no_key", message: "ODDS_API_KEY environment variable not set." } };
  }

  // Auto-discover active basketball sport keys from the account, then
  // fall back to a hardcoded list. This handles cases where the March
  // Madness games are listed under a key we didn't anticipate.
  let sportsToTry = ["basketball_ncaab", "basketball_ncaab_championship_winner"];
  try {
    const sportsRes = await fetch(
      `${ODDS_API_BASE}/sports/?apiKey=${apiKey}&all=false`,
      { cache: "no-store" }
    );
    if (sportsRes.ok) {
      const allSports: { key: string; active: boolean }[] = await sportsRes.json();
      const discovered = allSports
        .filter((s) => s.active && s.key.includes("ncaa") && s.key.includes("basketball"))
        .map((s) => s.key);
      if (discovered.length > 0) sportsToTry = discovered;
    }
  } catch {
    // fall through to hardcoded list
  }

  for (const sport of sportsToTry) {
    try {
      const url =
        `${ODDS_API_BASE}/sports/${sport}/odds/` +
        `?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=decimal`;

      const res = await fetch(url, { cache: "no-store" });

      if (res.status === 401) {
        return { odds: null, error: { type: "api_error", message: "Invalid API key (401). Check your ODDS_API_KEY in Vercel environment variables.", status: 401 } };
      }
      if (res.status === 422 || res.status === 431 || res.status === 404) {
        // Sport key unavailable or no games — try next
        continue;
      }
      if (!res.ok) {
        return { odds: null, error: { type: "api_error", message: `API returned ${res.status}`, status: res.status } };
      }

      const data: OddsApiGame[] = await res.json();
      if (!Array.isArray(data)) {
        return { odds: null, error: { type: "parse_error", message: "Unexpected API response format." } };
      }

      const parsed = parseOddsResponse(data);
      if (parsed.length === 0) {
        return { odds: [], error: { type: "no_games", message: `API returned 0 games for sport "${sport}". Games may not be posted yet.` } };
      }

      return { odds: parsed, error: null };
    } catch (e) {
      return { odds: null, error: { type: "parse_error", message: String(e) } };
    }
  }

  return { odds: null, error: { type: "no_games", message: `No NCAAB games found. Tried sport keys: ${sportsToTry.join(", ")}. Games may not be posted yet or your plan may not include this sport.` } };
}

function parseOddsResponse(data: OddsApiGame[]): GameOdds[] {
  const result: GameOdds[] = [];

  for (const game of data) {
    // Pick best bookmaker (prefer DraftKings → FanDuel → BetMGM → first available)
    const preferredOrder = ["draftkings", "fanduel", "betmgm"];
    const bookmaker =
      preferredOrder
        .map((k) => game.bookmakers.find((b) => b.key === k))
        .find(Boolean) ?? game.bookmakers[0];

    if (!bookmaker) continue;

    const market = bookmaker.markets.find((m) => m.key === "h2h");
    if (!market || market.outcomes.length < 2) continue;

    const [o1, o2] = market.outcomes;

    const t1Id = normalizeTeamName(o1.name);
    const t2Id = normalizeTeamName(o2.name);

    result.push({
      gameId: null, // matched later by team IDs
      apiMatchId: game.id,
      commenceTime: game.commence_time,
      team1: buildTeamOdds(o1.name, t1Id ?? o1.name, o1.price, bookmaker.title),
      team2: buildTeamOdds(o2.name, t2Id ?? o2.name, o2.price, bookmaker.title),
    });
  }

  return result;
}

function buildTeamOdds(
  apiName: string,
  teamId: string,
  decimal: number,
  bookmaker: string
): TeamOdds {
  return {
    teamId,
    teamName: apiName,
    decimalOdds: decimal,
    americanOdds: decimalToAmerican(decimal),
    impliedProbability: 1 / decimal,
    bookmaker,
  };
}

// ─── Match API odds to our bracket games ─────────────────────────────────────

import { GAMES } from "@/data/games";
import { getGameParticipant } from "@/lib/bracket";
import type { Results } from "@/lib/types";

/**
 * Given fetched API odds and our current results, match each API game
 * to the corresponding bracket game id.
 */
export function matchOddsToGames(
  liveOdds: GameOdds[],
  results: Results
): GameOdds[] {
  return liveOdds.map((apiGame) => {
    const t1 = apiGame.team1.teamId;
    const t2 = apiGame.team2.teamId;

    // Find our bracket game that has these two teams as participants
    const matched = GAMES.find((g) => {
      if (results[g.id]) return false; // already complete
      const p1 = getGameParticipant(g, "team1", results);
      const p2 = getGameParticipant(g, "team2", results);
      return (
        (p1 === t1 && p2 === t2) ||
        (p1 === t2 && p2 === t1)
      );
    });

    return { ...apiGame, gameId: matched?.id ?? null };
  });
}
