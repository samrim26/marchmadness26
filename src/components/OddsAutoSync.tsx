"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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

function normalize(name: string): string | null {
  return ESPN_NAME_MAP[name.toLowerCase()] ?? null;
}

function americanToDecimal(american: number): number {
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

async function fetchAndSync(): Promise<number> {
  const now = new Date();
  const dates: string[] = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`
    );
  }

  const oddsData: {
    team1Id: string;
    team2Id: string;
    team1AmericanOdds: number;
    team2AmericanOdds: number;
    bookmaker: string;
  }[] = [];

  for (const date of dates) {
    try {
      const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${date}&limit=50`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      const events: Record<string, unknown>[] = data.events ?? [];

      for (const event of events) {
        const comp = (event.competitions as Record<string, unknown>[])?.[0];
        if (!comp) continue;

        const oddsArr = comp.odds as Record<string, unknown>[] | undefined;
        if (!oddsArr || oddsArr.length === 0) continue;

        const oddsEntry =
          oddsArr.find((o) =>
            String((o.provider as Record<string, unknown>)?.name ?? "")
              .toLowerCase()
              .includes("draft")
          ) ??
          oddsArr.find((o) =>
            String((o.provider as Record<string, unknown>)?.name ?? "")
              .toLowerCase()
              .includes("espn")
          ) ??
          oddsArr[0];

        const ml = oddsEntry.moneyline as Record<string, unknown> | undefined;
        let awayML: number | null = null;
        let homeML: number | null = null;

        if (ml) {
          const away = (ml.away as Record<string, unknown> | undefined)?.close as
            | Record<string, unknown>
            | undefined;
          const home = (ml.home as Record<string, unknown> | undefined)?.close as
            | Record<string, unknown>
            | undefined;
          awayML =
            away?.odds != null ? Number(String(away.odds).replace("+", "")) : null;
          homeML =
            home?.odds != null ? Number(String(home.odds).replace("+", "")) : null;
        } else {
          awayML =
            ((oddsEntry.awayTeamOdds as Record<string, unknown> | undefined)
              ?.moneyLine as number) ?? null;
          homeML =
            ((oddsEntry.homeTeamOdds as Record<string, unknown> | undefined)
              ?.moneyLine as number) ?? null;
        }

        if (awayML == null || isNaN(awayML) || homeML == null || isNaN(homeML)) continue;

        const competitors = comp.competitors as Record<string, unknown>[] | undefined;
        const awayComp = competitors?.find((c) => c.homeAway === "away");
        const homeComp = competitors?.find((c) => c.homeAway === "home");
        if (!awayComp || !homeComp) continue;

        const awayTeam = awayComp.team as Record<string, unknown>;
        const homeTeam = homeComp.team as Record<string, unknown>;
        const awayName = String(awayTeam.shortDisplayName || awayTeam.displayName || "");
        const homeName = String(homeTeam.shortDisplayName || homeTeam.displayName || "");

        const awayId = normalize(awayName);
        const homeId = normalize(homeName);
        if (!awayId || !homeId) continue;

        // Validate decimal odds before accepting
        const d1 = americanToDecimal(awayML);
        const d2 = americanToDecimal(homeML);
        if (!isFinite(d1) || !isFinite(d2) || d1 <= 1 || d2 <= 1) continue;

        const bookmaker = String(
          (oddsEntry.provider as Record<string, unknown>)?.name ?? "DraftKings"
        );

        oddsData.push({
          team1Id: awayId,
          team2Id: homeId,
          team1AmericanOdds: awayML,
          team2AmericanOdds: homeML,
          bookmaker,
        });
      }
    } catch {
      // skip on error
    }
  }

  if (oddsData.length === 0) return 0;

  const res = await fetch("/api/odds/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oddsData }),
  });
  if (!res.ok) return 0;
  const json = await res.json() as { saved?: number };
  return json.saved ?? 0;
}

/**
 * Invisible component — fetches ESPN odds from the browser on mount,
 * saves them to KV, then re-renders the page so the server simulation
 * immediately picks up the real probabilities without a second manual refresh.
 */
export default function OddsAutoSync() {
  const router = useRouter();

  useEffect(() => {
    fetchAndSync()
      .then((saved) => {
        if (saved > 0) {
          router.refresh(); // re-run server components with fresh odds
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
