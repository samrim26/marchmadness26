import { NextRequest, NextResponse } from "next/server";
import { getManualOdds, setManualOdds } from "@/lib/manualOdds";
import type { ManualGameOdds } from "@/lib/manualOdds";
import { GAMES } from "@/data/games";

const VALID_GAME_IDS = new Set(GAMES.map((g) => g.id));

export async function GET() {
  const odds = await getManualOdds();
  return NextResponse.json(odds);
}

export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as ManualGameOdds;
  const { gameId, team1AmericanOdds, team2AmericanOdds, bookmaker } = body;

  if (!VALID_GAME_IDS.has(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }
  if (typeof team1AmericanOdds !== "number" || typeof team2AmericanOdds !== "number") {
    return NextResponse.json({ error: "Odds must be numbers" }, { status: 400 });
  }

  const current = await getManualOdds();
  const updated = current.filter((o) => o.gameId !== gameId);
  updated.push({ gameId, team1AmericanOdds, team2AmericanOdds, bookmaker: bookmaker ?? "DraftKings" });
  await setManualOdds(updated);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gameId } = await req.json();
  const current = await getManualOdds();
  await setManualOdds(current.filter((o) => o.gameId !== gameId));
  return NextResponse.json({ ok: true });
}
