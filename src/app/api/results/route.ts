import { NextRequest, NextResponse } from "next/server";
import { getResults, setResults } from "@/lib/getResults";
import { GAMES } from "@/data/games";
import { TEAMS } from "@/data/teams";
import type { Results } from "@/lib/types";

const VALID_GAME_IDS = new Set(GAMES.map((g) => g.id));
const VALID_TEAM_IDS = new Set(TEAMS.map((t) => t.id));

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await getResults();
  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "ADMIN_PASSWORD env var not set." }, { status: 500 });
  }

  const body = await req.json() as { password: string; gameId: string; winnerId: string };

  if (body.password !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!body.gameId || !body.winnerId) {
    return NextResponse.json({ error: "gameId and winnerId required" }, { status: 400 });
  }
  if (!VALID_GAME_IDS.has(body.gameId)) {
    return NextResponse.json({ error: `Unknown gameId: ${body.gameId}` }, { status: 400 });
  }
  if (!VALID_TEAM_IDS.has(body.winnerId)) {
    return NextResponse.json({ error: `Unknown winnerId: ${body.winnerId}` }, { status: 400 });
  }

  const current = await getResults();
  const updated: Results = { ...current, [body.gameId]: body.winnerId };
  await setResults(updated);

  return NextResponse.json({ ok: true, results: updated });
}

export async function DELETE(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "ADMIN_PASSWORD env var not set." }, { status: 500 });
  }

  const body = await req.json() as { password: string; gameId: string };

  if (body.password !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = await getResults();
  const updated: Results = { ...current };
  delete updated[body.gameId];
  await setResults(updated);

  return NextResponse.json({ ok: true, results: updated });
}
