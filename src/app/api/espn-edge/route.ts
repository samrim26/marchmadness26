export const runtime = "edge";
export const dynamic = "force-dynamic";

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

function upcomingDates(days = 5): string[] {
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

export async function GET() {
  const dates = upcomingDates(5);
  const results: Record<string, unknown> = {};

  for (const date of dates) {
    try {
      const res = await fetch(
        `${ESPN_BASE}/scoreboard?dates=${date}&limit=50`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            Accept: "application/json",
            Referer: "https://www.espn.com/",
          },
        }
      );
      const data = await res.json() as { events?: Record<string, unknown>[] };
      const events = data.events ?? [];
      results[date] = events.map((e) => ({
        name: e.name,
        hasOdds: Array.isArray(e.odds) && (e.odds as unknown[]).length > 0,
        oddsCount: Array.isArray(e.odds) ? (e.odds as unknown[]).length : 0,
      }));
    } catch (err) {
      results[date] = { error: String(err) };
    }
  }

  return Response.json(results);
}
