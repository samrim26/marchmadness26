import type { Game, Results, Entry } from "@/lib/types";

const ROUND_ORDER = [
  "first_round",
  "second_round",
  "sweet16",
  "elite8",
  "final4",
  "championship",
] as const;

export function sortGamesByRound(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round)
  );
}

export function getCompletedGames(games: Game[], results: Results): Game[] {
  return games.filter((g) => !!results[g.id]);
}

export function getRemainingGames(games: Game[], results: Results): Game[] {
  return games.filter((g) => !results[g.id]);
}

/**
 * Determine the actual participant for a given slot in a game, given current results.
 * Returns null if the source game hasn't been played yet.
 */
export function getGameParticipant(
  game: Game,
  slot: "team1" | "team2",
  results: Results
): string | null {
  const directTeam = slot === "team1" ? game.team1Id : game.team2Id;
  if (directTeam) return directTeam;

  const sourceGameId =
    slot === "team1" ? game.team1SourceGameId : game.team2SourceGameId;
  if (sourceGameId) {
    return results[sourceGameId] ?? null;
  }
  return null;
}

/**
 * Returns true if the given team can still win the given game,
 * considering current results.
 *
 * - If the game is complete, only the winner can "win" it.
 * - Otherwise, recursively checks whether the team can reach this game
 *   by winning all prerequisite games still unplayed.
 */
export function isPickStillAlive(
  teamId: string,
  gameId: string,
  games: Game[],
  results: Results
): boolean {
  // Already decided
  if (results[gameId] !== undefined) {
    return results[gameId] === teamId;
  }

  const game = games.find((g) => g.id === gameId);
  if (!game) return false;

  // Direct participant check (Sweet 16 fixed matchups)
  if (game.team1Id === teamId || game.team2Id === teamId) return true;

  // Check team1 source path
  if (game.team1SourceGameId) {
    const srcResult = results[game.team1SourceGameId];
    if (srcResult === teamId) return true; // already advanced here
    if (srcResult === undefined) {
      // Source game not played; can the team reach it?
      if (isPickStillAlive(teamId, game.team1SourceGameId, games, results))
        return true;
    }
    // If source game complete and team didn't win, can't come from this path
  }

  // Check team2 source path
  if (game.team2SourceGameId) {
    const srcResult = results[game.team2SourceGameId];
    if (srcResult === teamId) return true;
    if (srcResult === undefined) {
      if (isPickStillAlive(teamId, game.team2SourceGameId, games, results))
        return true;
    }
  }

  return false;
}

/**
 * Returns the set of teams that could still potentially win the given game
 * given current results.
 */
export function getReachableTeams(
  gameId: string,
  games: Game[],
  results: Results
): string[] {
  const game = games.find((g) => g.id === gameId);
  if (!game) return [];

  if (results[gameId]) return [results[gameId]];

  const teams1: string[] = game.team1Id
    ? [game.team1Id]
    : game.team1SourceGameId
    ? getReachableTeams(game.team1SourceGameId, games, results)
    : [];

  const teams2: string[] = game.team2Id
    ? [game.team2Id]
    : game.team2SourceGameId
    ? getReachableTeams(game.team2SourceGameId, games, results)
    : [];

  return [...teams1, ...teams2];
}

/**
 * Returns the games whose both participants are currently known
 * (Sweet 16 games always qualify; later games only after feeders are complete).
 */
export function getGamesWithKnownParticipants(
  games: Game[],
  results: Results
): Game[] {
  return games.filter((g) => {
    if (results[g.id]) return false; // already complete
    const t1 = getGameParticipant(g, "team1", results);
    const t2 = getGameParticipant(g, "team2", results);
    return t1 !== null && t2 !== null;
  });
}

/**
 * Returns picks that are still potentially scoreable (team can still win the game).
 */
export function getAlivePicksForEntry(
  entry: Entry,
  games: Game[],
  results: Results
): string[] {
  return Object.entries(entry.picks)
    .filter(([gameId, teamId]) => isPickStillAlive(teamId, gameId, games, results))
    .map(([gameId]) => gameId);
}
