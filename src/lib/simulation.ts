import type { Entry, EntryAnalytics, Game, Results, ScoringSettings } from "@/lib/types";
import { sortGamesByRound, getRemainingGames } from "@/lib/bracket";
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

interface OutcomeRow {
  outcome: Results;
  scores: number[]; // index matches entries array
  maxScore: number;
}

function buildOutcomeRows(
  outcomes: Results[],
  entries: Entry[],
  games: Game[]
): OutcomeRow[] {
  return outcomes.map((outcome) => {
    const scores = entries.map((e) =>
      scoreEntryAgainstOutcome(e, games, outcome)
    );
    const maxScore = Math.max(...scores);
    return { outcome, scores, maxScore };
  });
}

// ─── Per-entry probability computation ───────────────────────────────────────

export function computeEntryProbabilities(
  entries: Entry[],
  games: Game[],
  results: Results,
  settings: ScoringSettings
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
      numberOfWinningScenarios: 0,
      numberOfTieScenarios: 0,
      totalScenarios: 0,
      eliminated: true,
      rank: i + 1,
    }));
  }

  const rows = buildOutcomeRows(outcomes, entries, games);

  const soloWins = new Array(entries.length).fill(0);
  const tieWins = new Array(entries.length).fill(0);

  for (const row of rows) {
    const { scores, maxScore } = row;
    const tied = scores.filter((s) => s === maxScore).length;

    for (let i = 0; i < entries.length; i++) {
      if (scores[i] === maxScore) {
        if (tied === 1) soloWins[i]++;
        else tieWins[i]++;
      }
    }
  }

  const analytics: EntryAnalytics[] = entries.map((entry, i) => ({
    entryId: entry.id,
    displayName: entry.displayName,
    currentScore: calculateCurrentScore(entry, games, results),
    maxPossibleScore: calculateMaxPossibleScore(entry, games, results),
    soloWinProbability: soloWins[i] / n,
    tieForFirstProbability: tieWins[i] / n,
    firstOrTieProbability: (soloWins[i] + tieWins[i]) / n,
    numberOfWinningScenarios: soloWins[i],
    numberOfTieScenarios: tieWins[i],
    totalScenarios: n,
    eliminated: soloWins[i] + tieWins[i] === 0,
    rank: 0, // assigned after sort
  }));

  // Assign ranks by firstOrTieProbability (then currentScore as tiebreak for display)
  const sorted = [...analytics].sort(
    (a, b) =>
      b.firstOrTieProbability - a.firstOrTieProbability ||
      b.currentScore - a.currentScore
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
 */
export function conditionalProbs(
  rows: OutcomeRow[],
  gameId: string,
  winnerId: string,
  entryCount: number
): number[] {
  const filtered = rows.filter((r) => r.outcome[gameId] === winnerId);
  if (filtered.length === 0) return new Array(entryCount).fill(0);

  const counts = new Array(entryCount).fill(0);
  for (const row of filtered) {
    const { scores, maxScore } = row;
    for (let i = 0; i < entryCount; i++) {
      if (scores[i] === maxScore) counts[i]++;
    }
  }
  return counts.map((c) => c / filtered.length);
}

/**
 * Expose the raw outcome rows for use in rooting / scenario computation.
 * Caches outcomes so they are only enumerated once per call.
 */
export function buildOutcomeRowsForState(
  entries: Entry[],
  games: Game[],
  results: Results
): OutcomeRow[] {
  const outcomes = enumerateAllValidOutcomes(games, results);
  return buildOutcomeRows(outcomes, entries, games);
}
