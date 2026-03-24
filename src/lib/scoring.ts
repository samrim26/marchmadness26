import type { Entry, Game, Results, ScoringSettings } from "@/lib/types";
import { isPickStillAlive } from "@/lib/bracket";

/**
 * Points awarded for a given round.
 */
export function pointsForRound(
  round: string,
  settings: ScoringSettings
): number {
  return (settings as unknown as Record<string, number>)[round] ?? 0;
}

/**
 * Calculate how many points an entry has earned so far based on completed games.
 */
export function calculateCurrentScore(
  entry: Entry,
  games: Game[],
  results: Results
): number {
  let score = 0;
  for (const game of games) {
    const pick = entry.picks[game.id];
    if (!pick) continue;
    if (results[game.id] === pick) {
      score += game.pointsValue;
    }
  }
  return score;
}

/**
 * Calculate the maximum score an entry can still achieve.
 * Includes current score + points from all picks whose team is still alive.
 */
export function calculateMaxPossibleScore(
  entry: Entry,
  games: Game[],
  results: Results
): number {
  let score = 0;
  for (const game of games) {
    const pick = entry.picks[game.id];
    if (!pick) continue;

    if (results[game.id] !== undefined) {
      // Game is complete — only count if correct
      if (results[game.id] === pick) {
        score += game.pointsValue;
      }
    } else {
      // Game not yet played — count if pick is still alive
      if (isPickStillAlive(pick, game.id, games, results)) {
        score += game.pointsValue;
      }
    }
  }
  return score;
}

/**
 * Score an entry against a COMPLETE tournament outcome.
 * Used during simulation — the outcome map contains all game results.
 */
export function scoreEntryAgainstOutcome(
  entry: Entry,
  games: Game[],
  outcome: Results
): number {
  let score = 0;
  for (const game of games) {
    const pick = entry.picks[game.id];
    if (!pick) continue;
    if (outcome[game.id] === pick) {
      score += game.pointsValue;
    }
  }
  return score;
}
