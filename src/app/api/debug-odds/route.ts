import { NextResponse } from "next/server";
import { getManualOdds } from "@/lib/manualOdds";
import { GAMES } from "@/data/games";
import { getResults } from "@/lib/getResults";
import { manualOddsToGameProbs } from "@/lib/manualOdds";

export const dynamic = "force-dynamic";

export async function GET() {
  const kvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const odds = await getManualOdds();
  const results = await getResults();
  const gameProbs = manualOddsToGameProbs(odds, GAMES, results);

  return NextResponse.json({
    kvConfigured,
    oddsCount: odds.length,
    odds,
    gameProbsCount: Object.keys(gameProbs).length,
    gameProbs,
  });
}
