import type { Entry, EntryAnalytics, Game, Results, ScoringSettings } from "@/lib/types";
import { sortGamesByRound, getRemainingGames, getGameParticipant } from "@/lib/bracket";
import { scoreEntryAgainstOutcome, calculateCurrentScore, calculateMaxPossibleScore } from "@/lib/scoring";

// ─── Enumeration ─────────────────────────────────────────────────────────────

/**
 * Enumerate every valid tournament completion given the current results.
 *
 * Games are processed in round order. For each undecided game we try both
 * possible winners, propagating each choice to later-round games via the
 * shared mutable `partialResults` map (cleaned up after each branch).
 *
 * Result count: 2^(number of remaining games)
 * Sweet 16 → Championship: max 2^15 = 32,768 outcomes.
 */
export function enumerateAllValidOutcomes(
  games: Game[],
  currentResults: Results
): Results[] {
  const sorted = sortGamesByRound(getRemainingGames(games, currentResults));
  const outcomes: Results[] = [];
  const partial: Results = { ...currentResults };

  function recurse(idx: number) {
    if (idx === sorted.length) {
      outcomes.push({ ...partial });
      return;
    }

    const game = sorted[idx];

    // Determine participants — source games must already be in `partial`
    const t1 = game.team1Id ?? partial[game.team1SourceGameId!];
    const t2 = game.team2Id ?? partial[game.team2SourceGameId!];

    if (!t1 || !t2) {
      // Shouldn't happen if games are sorted by round, but skip gracefully
      recurse(idx + 1);
      return;
    }

    // Branch: t1 wins
    partial[game.id] = t1;
    recurse(idx + 1);

    // Branch: t2 wins
    partial[game.id] = t2;
    recurse(idx + 1);

    // Clean up this game's entry so parent levels are unaffected
    delete partial[game.id];
  }

  recurse(0);
  return outcomes;
}

// ─── Pre-computed outcome scores ─────────────────────────────────────────────

export interface OutcomeRow {
  outcome: Results;
  scores: number[]; // index matches entries array
  maxScore: number;
  weight: number; // probability weight for this outcome (default 1.0)
}

/**
 * Compute the probability weight for a given outcome as the product of
 * P(winner) for each remaining game. Uses gameProbs if available, else 0.5.
 */
function computeOutcomeWeight(
  outcome: Results,
  games: Game[],
  gameProbs: Record<string, { t1Prob: number; t2Prob: number }>
): number {
  let weight = 1.0;
  for (const game of games) {
    const winner = outcome[game.id];
    if (!winner) continue; // already decided before enumeration

    const probs = gameProbs[game.id];
    if (!probs) {
      weight *= 0.5;
      continue;
    }

    // Determine which slot the winner occupies
    // We need to figure out if winner is team1 or team2 of this game
    // The outcome map has the winner; we need to compare against participants
    // We can't use getGameParticipant with the partial outcome here, but since
    // we're iterating outcomes (fully resolved), we check the game's direct IDs
    // or fall back to source game results.
    const t1 = game.team1Id ?? outcome[game.team1SourceGameId!];
    const t2 = game.team2Id ?? outcome[game.team2SourceGameId!];

    if (winner === t1) {
      weight *= probs.t1Prob;
    } else if (winner === t2) {
      weight *= probs.t2Prob;
    } else {
      weight *= 0.5; // fallback
    }
  }
  return weight;
}

function buildOutcomeRows(
  outcomes: Results[],
  entries: Entry[],
  games: Game[],
  gameProbs?: Record<string, { t1Prob: number; t2Prob: number }>
): OutcomeRow[] {
  const resolvedProbs = gameProbs ?? {};
  return outcomes.map((outcome) => {
    const scores = entries.map((e) =>
      scoreEntryAgainstOutcome(e, games, outcome)
    );
    const maxScore = Math.max(...scores);
    const weight = computeOutcomeWeight(outcome, games, resolvedProbs);
    return { outcome, scores, maxScore, weight };
  });
}

// ─── Per-entry probability computation ───────────────────────────────────────

export function computeEntryProbabilities(
  entries: Entry[],
  games: Game[],
  results: Results,
  settings: ScoringSettings,
  gameProbs?: Record<string, { t1Prob: number; t2Prob: number }>
): EntryAnalytics[] {
  const outcomes = enumerateAllValidOutcomes(games, results);
  const n = outcomes.length;

  if (n === 0) {
    // Fallback if bracket is already fully determined
    return entries.map((entry, i) => ({
      entryId: entry.id,
      displayName: entry.displayName,
      currentScore: calculateCurrentScore(entry, games, results),
      maxPossibleScore: calculateMaxPossibleScore(entry, games, results),
      soloWinProbability: 0,
      tieForFirstProbability: 0,
      firstOrTieProbability: 0,
      secondPlaceProbability: 0,
      poolEV: -20,
      numberOfWinningScenarios: 0,
      numberOfTieScenarios: 0,
      numberOfSecondPlaceScenarios: 0,
      totalScenarios: 0,
      eliminated: true,
      rank: i + 1,
    }));
  }

  const rows = buildOutcomeRows(outcomes, entries, games, gameProbs);
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);

  const soloWins = new Array(entries.length).fill(0);
  const tieWins = new Array(entries.length).fill(0);
  const secondPlace = new Array(entries.length).fill(0);

  // Raw scenario counts (unweighted) for display purposes
  const soloWinCount = new Array(entries.length).fill(0);
  const tieWinCount = new Array(entries.length).fill(0);
  const secondPlaceCount = new Array(entries.length).fill(0);

  for (const row of rows) {
    const { scores, maxScore, weight } = row;
    const tied = scores.filter((s) => s === maxScore).length;

    // Find second-place score (highest score that isn't first place)
    const secondMax = Math.max(...scores.filter((s) => s < maxScore), -Infinity);

    for (let i = 0; i < entries.length; i++) {
      if (scores[i] === maxScore) {
        if (tied === 1) {
          soloWins[i] += weight;
          soloWinCount[i]++;
        } else {
          tieWins[i] += weight;
          tieWinCount[i]++;
        }
      } else if (secondMax !== -Infinity && scores[i] === secondMax) {
        secondPlace[i] += weight;
        secondPlaceCount[i]++;
      }
    }
  }

  const NET_FIRST = 160;   // net profit if win pool ($180 prize - $20 entry)
  const NET_SECOND = 0;    // net if 2nd (break even)
  const NET_OUT = -20;     // net if out (lose entry fee)

  const analytics: EntryAnalytics[] = entries.map((entry, i) => {
    const pFirst = (soloWins[i] + tieWins[i]) / totalWeight;
    const pSecond = secondPlace[i] / totalWeight;
    const pOut = 1 - pFirst - pSecond;
    const poolEV = pFirst * NET_FIRST + pSecond * NET_SECOND + pOut * NET_OUT;
    return {
      entryId: entry.id,
      displayName: entry.displayName,
      currentScore: calculateCurrentScore(entry, games, results),
      maxPossibleScore: calculateMaxPossibleScore(entry, games, results),
      soloWinProbability: soloWins[i] / totalWeight,
      tieForFirstProbability: tieWins[i] / totalWeight,
      firstOrTieProbability: pFirst,
      secondPlaceProbability: pSecond,
      poolEV,
      numberOfWinningScenarios: soloWinCount[i],
      numberOfTieScenarios: tieWinCount[i],
      numberOfSecondPlaceScenarios: secondPlaceCount[i],
      totalScenarios: n,
      eliminated: soloWinCount[i] + tieWinCount[i] === 0,
      rank: 0, // assigned after sort
    };
  });

  // Assign ranks by firstOrTieProbability (then currentScore as tiebreak for display)
  const sorted = [...analytics].sort(
    (a, b) =>
      b.firstOrTieProbability - a.firstOrTieProbability ||
      b.currentScore - a.currentScore ||
      a.displayName.localeCompare(b.displayName)
  );
  sorted.forEach((a, i) => {
    analytics.find((x) => x.entryId === a.entryId)!.rank = i + 1;
  });

  return analytics;
}

// ─── Conditional probabilities (used by rooting guide) ───────────────────────

/**
 * Given pre-computed outcome rows, compute each entry's firstOrTieProbability
 * within the subset of outcomes where the specified game has a specific winner.
 * Uses row weights for probability-accurate results.
 */
export function conditionalProbs(
  rows: OutcomeRow[],
  gameId: string,
  winnerId: string,
  entryCount: number
): number[] {
  const filtered = rows.filter((r) => r.outcome[gameId] === winnerId);
  if (filtered.length === 0) return new Array(entryCount).fill(0);

  const totalWeight = filtered.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return new Array(entryCount).fill(0);

  const weightedCounts = new Array(entryCount).fill(0);
  for (const row of filtered) {
    const { scores, maxScore, weight } = row;
    for (let i = 0; i < entryCount; i++) {
      if (scores[i] === maxScore) weightedCounts[i] += weight;
    }
  }
  return weightedCounts.map((c) => c / totalWeight);
}

/**
 * For a subset of outcome rows (already filtered by a condition, e.g. "team X wins game G"),
 * compute each entry's pool EV using weighted probabilities.
 *
 * Returns array of EVs indexed by entry position.
 */
export function conditionalPoolEVs(
  rows: OutcomeRow[],
  entryCount: number,
  NET_FIRST = 160,
  NET_SECOND = 0,
  NET_OUT = -20
): number[] {
  if (rows.length === 0) return new Array(entryCount).fill(NET_OUT);

  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return new Array(entryCount).fill(NET_OUT);

  const firstWeights = new Array(entryCount).fill(0);
  const secondWeights = new Array(entryCount).fill(0);

  for (const row of rows) {
    const { scores, maxScore, weight } = row;
    const secondMax = Math.max(...scores.filter((s) => s < maxScore), -Infinity);

    for (let i = 0; i < entryCount; i++) {
      if (scores[i] === maxScore) {
        firstWeights[i] += weight;
      } else if (secondMax !== -Infinity && scores[i] === secondMax) {
        secondWeights[i] += weight;
      }
    }
  }

  return Array.from({ length: entryCount }, (_, i) => {
    const pFirst = firstWeights[i] / totalWeight;
    const pSecond = secondWeights[i] / totalWeight;
    const pOut = 1 - pFirst - pSecond;
    return pFirst * NET_FIRST + pSecond * NET_SECOND + pOut * NET_OUT;
  });
}

/**
 * Given a subset of outcome rows (filtered by some condition),
 * compute per-entry P(entry wins or ties first) using weighted rows.
 * Returns array of probabilities indexed by entry position.
 */
export function computeConditionalWinProbs(
  rows: OutcomeRow[],
  entryCount: number
): number[] {
  if (rows.length === 0) return new Array(entryCount).fill(0);

  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return new Array(entryCount).fill(0);

  const weightedWins = new Array(entryCount).fill(0);
  for (const row of rows) {
    const { scores, maxScore, weight } = row;
    for (let i = 0; i < entryCount; i++) {
      if (scores[i] === maxScore) weightedWins[i] += weight;
    }
  }
  return weightedWins.map((w) => w / totalWeight);
}

/**
 * Return every outcome in which the given entry finishes first or tied for first.
 * Used by the "path to victory" detail page.
 */
export function getWinningOutcomes(
  entryId: string,
  entries: Entry[],
  games: Game[],
  results: Results
): Results[] {
  const entryIdx = entries.findIndex((e) => e.id === entryId);
  if (entryIdx === -1) return [];
  const outcomes = enumerateAllValidOutcomes(games, results);
  const rows = buildOutcomeRows(outcomes, entries, games);
  return rows
    .filter((row) => row.scores[entryIdx] === row.maxScore)
    .map((row) => row.outcome);
}

/**
 * Expose the raw outcome rows for use in rooting / scenario computation.
 * Caches outcomes so they are only enumerated once per call.
 */
export function buildOutcomeRowsForState(
  entries: Entry[],
  games: Game[],
  results: Results,
  gameProbs?: Record<string, { t1Prob: number; t2Prob: number }>
): OutcomeRow[] {
  const outcomes = enumerateAllValidOutcomes(games, results);
  return buildOutcomeRows(outcomes, entries, games, gameProbs);
}
