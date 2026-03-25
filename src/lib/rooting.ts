import type {
  Entry,
  EntryRootingData,
  Game,
  Results,
  RootingRecommendation,
  RootingStrength,
  ScenarioDelta,
  ScoringSettings,
} from "@/lib/types";
import {
  getGameParticipant,
  getGamesWithKnownParticipants,
} from "@/lib/bracket";
import {
  buildOutcomeRowsForState,
  conditionalProbs,
} from "@/lib/simulation";
import { getTeamName } from "@/data/teams";
import type { GameProbs } from "@/lib/manualOdds";

// ─── Rooting strength classification ─────────────────────────────────────────

function classifyStrength(delta: number): RootingStrength {
  const pct = delta * 100;
  if (pct === 0) return "neutral";
  if (pct < 3) return "slight";
  if (pct < 10) return "moderate";
  return "strong";
}

// ─── Per-entry rooting recommendations ───────────────────────────────────────

/**
 * Compute rooting recommendations for every entry across every
 * remaining game with known participants.
 *
 * We enumerate outcomes ONCE and reuse them for all games / entries.
 */
export function getAllRootingData(
  entries: Entry[],
  games: Game[],
  results: Results,
  _settings: ScoringSettings,
  gameProbs?: GameProbs
): EntryRootingData[] {
  const actionableGames = getGamesWithKnownParticipants(games, results);

  if (actionableGames.length === 0) {
    return entries.map((e) => ({
      entryId: e.id,
      recommendations: [],
      bestGame: null,
      worstGame: null,
    }));
  }

  // Enumerate outcomes once
  const rows = buildOutcomeRowsForState(entries, games, results, gameProbs);
  const n = entries.length;

  // For each game, compute conditional probs for each possible winner
  const gameRecs: Map<string, { t1Probs: number[]; t2Probs: number[] }> =
    new Map();

  for (const game of actionableGames) {
    const t1 = getGameParticipant(game, "team1", results)!;
    const t2 = getGameParticipant(game, "team2", results)!;
    gameRecs.set(game.id, {
      t1Probs: conditionalProbs(rows, game.id, t1, n),
      t2Probs: conditionalProbs(rows, game.id, t2, n),
    });
  }

  return entries.map((entry, ei) => {
    const recommendations: RootingRecommendation[] = actionableGames.map(
      (game) => {
        const t1 = getGameParticipant(game, "team1", results)!;
        const t2 = getGameParticipant(game, "team2", results)!;
        const { t1Probs, t2Probs } = gameRecs.get(game.id)!;

        const p1 = t1Probs[ei];
        const p2 = t2Probs[ei];
        const delta = Math.abs(p1 - p2);
        const preferred = p1 > p2 ? t1 : p2 > p1 ? t2 : null;

        return {
          gameId: game.id,
          gameLabel: game.label,
          team1Id: t1,
          team2Id: t2,
          team1Name: getTeamName(t1),
          team2Name: getTeamName(t2),
          preferredTeamId: preferred,
          preferredTeamName: preferred ? getTeamName(preferred) : null,
          probabilityWithTeam1: p1,
          probabilityWithTeam2: p2,
          delta,
          strength: classifyStrength(delta),
        };
      }
    );

    // Best and worst single-game outcomes
    const sorted = [...recommendations].sort((a, b) => {
      // best = highest delta in favoured direction
      const aNet = a.preferredTeamId
        ? a.probabilityWithTeam1 >= a.probabilityWithTeam2
          ? a.probabilityWithTeam1 - a.probabilityWithTeam2
          : a.probabilityWithTeam2 - a.probabilityWithTeam1
        : 0;
      const bNet = b.preferredTeamId
        ? b.probabilityWithTeam1 >= b.probabilityWithTeam2
          ? b.probabilityWithTeam1 - b.probabilityWithTeam2
          : b.probabilityWithTeam2 - b.probabilityWithTeam1
        : 0;
      return bNet - aNet;
    });

    return {
      entryId: entry.id,
      recommendations,
      bestGame: sorted[0] ?? null,
      worstGame: sorted[sorted.length - 1] ?? null,
    };
  });
}

// ─── Scenario deltas (for the Scenarios page) ────────────────────────────────

/**
 * For each remaining game with known participants, compute how each
 * possible winner shifts every entry's firstOrTieProbability.
 */
export function computeScenarioDeltas(
  entries: Entry[],
  games: Game[],
  results: Results,
  _settings: ScoringSettings,
  gameProbs?: GameProbs
): ScenarioDelta[] {
  const actionableGames = getGamesWithKnownParticipants(games, results);
  if (actionableGames.length === 0) return [];

  const rows = buildOutcomeRowsForState(entries, games, results, gameProbs);
  const n = entries.length;

  // Weighted baseline probabilities
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const baseTotals = rows[0]?.scores.map(() => 0) ?? new Array(n).fill(0);
  for (const row of rows) {
    for (let i = 0; i < n; i++) {
      if (row.scores[i] === row.maxScore) baseTotals[i] += row.weight;
    }
  }
  const baseProbs = baseTotals.map((c) => c / (totalWeight || 1));

  const deltas: ScenarioDelta[] = [];

  for (const game of actionableGames) {
    const t1 = getGameParticipant(game, "team1", results)!;
    const t2 = getGameParticipant(game, "team2", results)!;

    for (const winner of [t1, t2]) {
      const condProbs = conditionalProbs(rows, game.id, winner, n);
      deltas.push({
        gameId: game.id,
        gameLabel: game.label,
        winnerId: winner,
        winnerName: getTeamName(winner),
        deltas: entries.map((e, i) => ({
          entryId: e.id,
          displayName: e.displayName,
          before: baseProbs[i],
          after: condProbs[i],
          delta: condProbs[i] - baseProbs[i],
        })),
      });
    }
  }

  return deltas;
}
