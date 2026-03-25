import { NextResponse } from "next/server";

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date();
  const dates = [0, 1, 2, 3].map((i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  });

  const results: Record<string, unknown> = {};

  for (const date of dates) {
    try {
      const res = await fetch(
        `${ESPN_BASE}/scoreboard?dates=${date}&limit=50`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const events = (data.events ?? []) as Record<string, unknown>[];

      results[date] = events.map((e) => ({
        id: e.id,
        name: e.name,
        hasOdds: Array.isArray(e.odds) && (e.odds as unknown[]).length > 0,
        oddsCount: Array.isArray(e.odds) ? (e.odds as unknown[]).length : 0,
        oddsSnapshot: Array.isArray(e.odds) ? (e.odds as unknown[])[0] : null,
        competitorNames: Array.isArray(e.competitions)
          ? (e.competitions as Record<string, unknown>[])[0]
              ?.competitors as unknown
          : null,
      }));
    } catch (err) {
      results[date] = { error: String(err) };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
