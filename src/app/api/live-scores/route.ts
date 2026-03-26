import { NextResponse } from "next/server";
import { fetchESPNSchedule } from "@/lib/espnSchedule";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch past 1 day + next 3 days to show recent finals + upcoming
    const games = await fetchESPNSchedule(1, 3);
    return NextResponse.json({ games });
  } catch {
    return NextResponse.json({ games: [] });
  }
}
