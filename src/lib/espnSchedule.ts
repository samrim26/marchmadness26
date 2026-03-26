/**
 * Fetches NCAA tournament game schedule + live scores from ESPN.
 * Event/schedule data (NOT odds) is accessible from the server.
 */

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

function normalizeTeam(name: string): string | null {
  return ESPN_NAME_MAP[name.toLowerCase()] ?? null;
}

export interface ESPNGameInfo {
  /** Our internal team IDs for each side (null if unknown) */
  team1Id: string | null;
  team2Id: string | null;
  team1Name: string;
  team2Name: string;
  /** ISO date string of the scheduled tip-off */
  startTime: string;
  /** Human-readable time string, e.g. "7:09 PM ET" */
  timeDisplay: string;
  /** "pre" | "in" | "post" */
  statusState: string;
  /** e.g. "1st Half", "Halftime", "Final", "3/27 7:09 PM ET" */
  statusDetail: string;
  /** Scores — only meaningful when statusState is "in" or "post" */
  team1Score: number | null;
  team2Score: number | null;
  /** ESPN event id */
  espnId: string;
}

/**
 * Fetch schedule info for a range of dates. Returns one entry per game
 * that involves at least one of our tracked teams.
 * Safe to call server-side — ESPN returns event data (not odds) without IP restrictions.
 */
export async function fetchESPNSchedule(
  daysBack = 3,
  daysAhead = 7
): Promise<ESPNGameInfo[]> {
  const now = new Date();
  const dates: string[] = [];
  for (let i = -daysBack; i <= daysAhead; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`
    );
  }

  const results: ESPNGameInfo[] = [];

  for (const date of dates) {
    try {
      const res = await fetch(
        `${ESPN_BASE}/scoreboard?dates=${date}&limit=50&groups=100`,
        { next: { revalidate: 30 } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const events: Record<string, unknown>[] = data.events ?? [];

      for (const event of events) {
        const comp = (event.competitions as Record<string, unknown>[])?.[0];
        if (!comp) continue;

        const competitors = comp.competitors as
          | Record<string, unknown>[]
          | undefined;
        if (!competitors || competitors.length < 2) continue;

        const awayComp = competitors.find((c) => c.homeAway === "away");
        const homeComp = competitors.find((c) => c.homeAway === "home");
        if (!awayComp || !homeComp) continue;

        const awayTeam = awayComp.team as Record<string, unknown>;
        const homeTeam = homeComp.team as Record<string, unknown>;
        const awayName = String(
          awayTeam.shortDisplayName || awayTeam.displayName || ""
        );
        const homeName = String(
          homeTeam.shortDisplayName || homeTeam.displayName || ""
        );

        // Only include games with at least one of our tracked teams
        const awayId = normalizeTeam(awayName);
        const homeId = normalizeTeam(homeName);
        if (!awayId && !homeId) continue;

        // Scores
        const awayScore =
          awayComp.score != null ? Number(awayComp.score) : null;
        const homeScore =
          homeComp.score != null ? Number(homeComp.score) : null;

        // Status
        const statusObj = comp.status as Record<string, unknown> | undefined;
        const statusType = statusObj?.type as
          | Record<string, unknown>
          | undefined;
        const statusState = String(statusType?.state ?? "pre");
        const statusDetail = String(statusType?.shortDetail ?? statusType?.detail ?? "");

        // Time
        const startTime = String(event.date ?? "");

        // Format a short time display
        let timeDisplay = statusDetail;
        if (statusState === "pre" && startTime) {
          try {
            timeDisplay = new Date(startTime).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: "America/New_York",
              timeZoneName: "short",
            });
          } catch {
            // keep statusDetail
          }
        }

        results.push({
          team1Id: awayId,
          team2Id: homeId,
          team1Name: awayName,
          team2Name: homeName,
          startTime,
          timeDisplay,
          statusState,
          statusDetail,
          team1Score: awayScore,
          team2Score: homeScore,
          espnId: String(event.id ?? ""),
        });
      }
    } catch {
      // skip date
    }
  }

  // Sort by startTime ascending
  results.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return results;
}

/**
 * Build a map from our game ID to ESPN schedule info by matching
 * the two resolved team IDs in each game.
 */
export function buildGameTimeMap(
  espnGames: ESPNGameInfo[],
  games: {
    id: string;
    team1Id?: string | null;
    team2Id?: string | null;
    team1SourceGameId?: string | null;
    team2SourceGameId?: string | null;
  }[],
  results: Record<string, string>
): Record<string, ESPNGameInfo> {
  const map: Record<string, ESPNGameInfo> = {};

  for (const game of games) {
    // Resolve team1
    const t1 =
      game.team1Id ??
      (game.team1SourceGameId ? results[game.team1SourceGameId] ?? null : null);
    // Resolve team2
    const t2 =
      game.team2Id ??
      (game.team2SourceGameId ? results[game.team2SourceGameId] ?? null : null);

    if (!t1 || !t2) continue;

    const espn = espnGames.find(
      (e) =>
        (e.team1Id === t1 && e.team2Id === t2) ||
        (e.team1Id === t2 && e.team2Id === t1)
    );
    if (espn) map[game.id] = espn;
  }

  return map;
}
