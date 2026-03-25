import { americanToDecimal } from "@/lib/odds";
import type { Game } from "@/lib/types";
import type { Results } from "@/lib/types";
import { getGameParticipant } from "@/lib/bracket";

export interface ManualGameOdds {
  gameId: string;
  team1AmericanOdds: number;
  team2AmericanOdds: number;
  bookmaker: string;
}

export type GameProbs = Record<string, { t1Prob: number; t2Prob: number }>;

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

/**
 * Convert manual odds entries to fair implied probabilities (vig-removed).
 * Maps gameId → { t1Prob, t2Prob } where t1 = getGameParticipant("team1").
 */
export function manualOddsToGameProbs(
  manualOdds: ManualGameOdds[],
  games: Game[],
  results: Results
): GameProbs {
  const probs: GameProbs = {};
  for (const entry of manualOdds) {
    const game = games.find((g) => g.id === entry.gameId);
    if (!game) continue;
    const t1 = getGameParticipant(game, "team1", results);
    const t2 = getGameParticipant(game, "team2", results);
    if (!t1 || !t2) continue;

    const d1 = americanToDecimal(entry.team1AmericanOdds);
    const d2 = americanToDecimal(entry.team2AmericanOdds);
    const raw1 = 1 / d1;
    const raw2 = 1 / d2;
    const total = raw1 + raw2; // > 1 due to vig

    // Which manual entry slot is t1?
    // team1AmericanOdds corresponds to the team in game.team1Id slot
    // manualOdds were saved with team1 = getGameParticipant team1
    probs[entry.gameId] = {
      t1Prob: raw1 / total, // vig-removed
      t2Prob: raw2 / total,
    };
  }
  return probs;
}
