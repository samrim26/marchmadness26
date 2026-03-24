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

  const rows = buildOutcomeRows(outcomes, entries, games);

  const soloWins = new Array(entries.length).fill(0);
  const tieWins = new Array(entries.length).fill(0);
  const secondPlace = new Array(entries.length).fill(0);

  for (const row of rows) {
    const { scores, maxScore } = row;
    const tied = scores.filter((s) => s === maxScore).length;

    // Find second-place score (highest score that isn't first place)
    const secondMax = Math.max(...scores.filter((s) => s < maxScore), -Infinity);

    for (let i = 0; i < entries.length; i++) {
      if (scores[i] === maxScore) {
        if (tied === 1) soloWins[i]++;
        else tieWins[i]++;
      } else if (secondMax !== -Infinity && scores[i] === secondMax) {
        secondPlace[i]++;
      }
    }
  }

  const NET_FIRST = 160;   // net profit if win pool ($180 prize - $20 entry)
  const NET_SECOND = 0;    // net if 2nd (break even)
  const NET_OUT = -20;     // net if out (lose entry fee)

  const analytics: EntryAnalytics[] = entries.map((entry, i) => {
    const pFirst = (soloWins[i] + tieWins[i]) / n;
    const pSecond = secondPlace[i] / n;
    const pOut = 1 - pFirst - pSecond;
    const poolEV = pFirst * NET_FIRST + pSecond * NET_SECOND + pOut * NET_OUT;
    return {
      entryId: entry.id,
      displayName: entry.displayName,
      currentScore: calculateCurrentScore(entry, games, results),
      maxPossibleScore: calculateMaxPossibleScore(entry, games, results),
      soloWinProbability: soloWins[i] / n,
      tieForFirstProbability: tieWins[i] / n,
      firstOrTieProbability: pFirst,
      secondPlaceProbability: pSecond,
      poolEV,
      numberOfWinningScenarios: soloWins[i],
      numberOfTieScenarios: tieWins[i],
      numberOfSecondPlaceScenarios: secondPlace[i],
      totalScenarios: n,
      eliminated: soloWins[i] + tieWins[i] === 0,
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
 * For a subset of outcome rows (already filtered by a condition, e.g. "team X wins game G"),
 * compute each entry's pool EV.
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

  const firstCounts = new Array(entryCount).fill(0);
  const secondCounts = new Array(entryCount).fill(0);
  const n = rows.length;

  for (const row of rows) {
    const { scores, maxScore } = row;
    const tied = scores.filter((s) => s === maxScore).length;
    const secondMax = Math.max(...scores.filter((s) => s < maxScore), -Infinity);

    for (let i = 0; i < entryCount; i++) {
      if (scores[i] === maxScore) {
        firstCounts[i]++;
      } else if (secondMax !== -Infinity && scores[i] === secondMax) {
        secondCounts[i]++;
      }
    }
  }

  return Array.from({ length: entryCount }, (_, i) => {
    const pFirst = firstCounts[i] / n;
    const pSecond = secondCounts[i] / n;
    const pOut = 1 - pFirst - pSecond;
    return pFirst * NET_FIRST + pSecond * NET_SECOND + pOut * NET_OUT;
  });
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
  results: Results
): OutcomeRow[] {
  const outcomes = enumerateAllValidOutcomes(games, results);
  return buildOutcomeRows(outcomes, entries, games);
}
