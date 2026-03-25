import { NextRequest, NextResponse } from "next/server";
import { GAMES } from "@/data/games";
import { getResults } from "@/lib/getResults";
import { getManualOdds, setManualOdds } from "@/lib/manualOdds";
import { getGamesWithKnownParticipants, getGameParticipant } from "@/lib/bracket";

interface SyncOddsEntry {
  team1Id: string;
  team2Id: string;
  team1AmericanOdds: number;
  team2AmericanOdds: number;
  bookmaker: string;
}

/**
 * POST /api/odds/sync
 * No password required — called automatically from the browser.
 * Accepts ESPN-parsed odds keyed by team IDs, maps them to game IDs server-side,
 * and saves to KV so the simulation can use real probabilities.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { oddsData: SyncOddsEntry[] };
    const { oddsData } = body;
    if (!Array.isArray(oddsData) || oddsData.length === 0) {
      return NextResponse.json({ ok: true, saved: 0 });
    }

    const RESULTS = await getResults();
    const knownGames = getGamesWithKnownParticipants(GAMES, RESULTS);

    const current = await getManualOdds();
    let updated = [...current];
    let saved = 0;

    for (const game of knownGames) {
      const t1 = getGameParticipant(game, "team1", RESULTS);
      const t2 = getGameParticipant(game, "team2", RESULTS);
      if (!t1 || !t2) continue;

      // Find matching ESPN entry regardless of home/away order
      const match = oddsData.find(
        (o) =>
          (o.team1Id === t1 && o.team2Id === t2) ||
          (o.team1Id === t2 && o.team2Id === t1)
      );
      if (!match) continue;

      // Ensure odds are oriented with t1 = game.team1 participant
      const flipped = match.team1Id === t2;
      const t1American = flipped ? match.team2AmericanOdds : match.team1AmericanOdds;
      const t2American = flipped ? match.team1AmericanOdds : match.team2AmericanOdds;

      updated = updated.filter((o) => o.gameId !== game.id);
      updated.push({
        gameId: game.id,
        team1AmericanOdds: t1American,
        team2AmericanOdds: t2American,
        bookmaker: match.bookmaker,
      });
      saved++;
    }

    await setManualOdds(updated);
    return NextResponse.json({ ok: true, saved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
