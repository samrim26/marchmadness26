// ─── Core Domain Types ───────────────────────────────────────────────────────

export type Round =
  | "first_round"
  | "second_round"
  | "sweet16"
  | "elite8"
  | "final4"
  | "championship";

export type Region = "East" | "South" | "West" | "Midwest" | "FinalFour" | "Championship";

export interface Team {
  id: string;
  name: string;
  seed: number;
  region: Region;
}

export interface Game {
  id: string;
  round: Round;
  region: Region | string;
  /** Direct team id if known at bracket creation time (Sweet 16 games) */
  team1Id: string | null;
  team2Id: string | null;
  /** Source game whose winner fills this slot (Elite 8 and later) */
  team1SourceGameId: string | null;
  team2SourceGameId: string | null;
  /** Where this game's winner advances */
  feedsIntoGameId: string | null;
  feedsIntoSlot: "team1" | "team2" | null;
  pointsValue: number;
  label: string; // e.g. "East Regional Final"
}

/** gameId -> winnerId */
export type Results = Record<string, string>;

/** gameId -> predicted winnerId */
export type Picks = Record<string, string>;

export interface Entry {
  id: string;
  displayName: string;
  picks: Picks;
}

export interface ScoringSettings {
  first_round: number;
  second_round: number;
  sweet16: number;
  elite8: number;
  final4: number;
  championship: number;
}

export interface TournamentState {
  teams: Team[];
  games: Game[];
  results: Results;
  entries: Entry[];
  settings: ScoringSettings;
}

// ─── Analytics Types ─────────────────────────────────────────────────────────

export interface EntryAnalytics {
  entryId: string;
  displayName: string;
  currentScore: number;
  maxPossibleScore: number;
  soloWinProbability: number;
  tieForFirstProbability: number;
  firstOrTieProbability: number;
  numberOfWinningScenarios: number;
  numberOfTieScenarios: number;
  totalScenarios: number;
  eliminated: boolean;
  rank: number;
}

export type RootingStrength = "strong" | "moderate" | "slight" | "neutral";

export interface RootingRecommendation {
  gameId: string;
  gameLabel: string;
  team1Id: string | null;
  team2Id: string | null;
  team1Name: string | null;
  team2Name: string | null;
  preferredTeamId: string | null;
  preferredTeamName: string | null;
  probabilityWithTeam1: number;
  probabilityWithTeam2: number;
  delta: number;
  strength: RootingStrength;
}

export interface EntryRootingData {
  entryId: string;
  recommendations: RootingRecommendation[];
  bestGame: RootingRecommendation | null;
  worstGame: RootingRecommendation | null;
}

export interface ScenarioDelta {
  gameId: string;
  gameLabel: string;
  winnerId: string;
  winnerName: string;
  deltas: {
    entryId: string;
    displayName: string;
    before: number;
    after: number;
    delta: number;
  }[];
}

// ─── Computed State ───────────────────────────────────────────────────────────

export interface ComputedState {
  analytics: EntryAnalytics[];
  rootingData: EntryRootingData[];
  scenarioDeltas: ScenarioDelta[];
  totalScenarios: number;
  remainingGamesCount: number;
  completedGamesCount: number;
}
