import { NextRequest, NextResponse } from "next/server";
import { GAMES } from "@/data/games";
import { TEAMS } from "@/data/teams";
import { getResults, setResults } from "@/lib/getResults";
import { getGamesWithKnownParticipants, getGameParticipant } from "@/lib/bracket";

interface SyncResultEntry {
  team1Id: string;
  team2Id: string;
  winnerId: string;
}

const VALID_TEAM_IDS = new Set(TEAMS.map((t) => t.id));

/**
 * POST /api/results/autosync
 * No password required — only records factual completed game results from ESPN.
 * Accepts team-ID pairs with a winner; maps to game IDs server-side via GAMES + KV state.
 * Idempotent: skips games already recorded with the same winner.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { resultsData: SyncResultEntry[] };
    const { resultsData } = body;

    if (!Array.isArray(resultsData) || resultsData.length === 0) {
      return NextResponse.json({ ok: true, saved: 0 });
    }

    const currentResults = await getResults();
    const knownGames = getGamesWithKnownParticipants(GAMES, currentResults);

    const updatedResults = { ...currentResults };
    let saved = 0;

    for (const entry of resultsData) {
      // Validate all three IDs are real Sweet 16 teams
      if (
        !VALID_TEAM_IDS.has(entry.team1Id) ||
        !VALID_TEAM_IDS.has(entry.team2Id) ||
        !VALID_TEAM_IDS.has(entry.winnerId)
      )
        continue;

      // Winner must be one of the two teams
      if (entry.winnerId !== entry.team1Id && entry.winnerId !== entry.team2Id)
        continue;

      // Find the matching game by participant IDs
      const game = knownGames.find((g) => {
        const t1 = getGameParticipant(g, "team1", currentResults);
        const t2 = getGameParticipant(g, "team2", currentResults);
        return (
          (t1 === entry.team1Id && t2 === entry.team2Id) ||
          (t1 === entry.team2Id && t2 === entry.team1Id)
        );
      });

      if (!game) continue;

      // Skip if already recorded correctly (idempotent)
      if (updatedResults[game.id] === entry.winnerId) continue;

      updatedResults[game.id] = entry.winnerId;
      saved++;
    }

    if (saved > 0) {
      await setResults(updatedResults);
    }

    return NextResponse.json({ ok: true, saved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
