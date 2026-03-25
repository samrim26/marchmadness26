export interface ManualGameOdds {
  gameId: string;
  team1AmericanOdds: number;
  team2AmericanOdds: number;
  bookmaker: string;
}

export async function getManualOdds(): Promise<ManualGameOdds[]> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return [];
  }
  try {
    const { kv } = await import("@vercel/kv");
    const stored = await kv.get<ManualGameOdds[]>("tournament:odds");
    return stored ?? [];
  } catch {
    return [];
  }
}

export async function setManualOdds(odds: ManualGameOdds[]): Promise<void> {
  const { kv } = await import("@vercel/kv");
  await kv.set("tournament:odds", odds);
}
