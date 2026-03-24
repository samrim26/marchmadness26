import type { Game } from "@/lib/types";

/**
 * All 15 remaining tournament games starting from the Sweet 16.
 *
 * Game IDs are stable keys used in picks and results.
 * team1Id / team2Id: set for Sweet 16 games (fixed matchups).
 * team1SourceGameId / team2SourceGameId: set for later rounds (determined by earlier winners).
 * feedsIntoGameId + feedsIntoSlot: how winners advance.
 * pointsValue: points awarded for correctly picking this game's winner.
 */
export const GAMES: Game[] = [
  // ── Sweet 16 ──────────────────────────────────────────────────────────────

  // East
  {
    id: "s16-east-1",
    round: "sweet16",
    region: "East",
    team1Id: "duke",
    team2Id: "stjohns",
    team1SourceGameId: null,
    team2SourceGameId: null,
    feedsIntoGameId: "e8-east",
    feedsIntoSlot: "team1",
    pointsValue: 4,
    label: "East Sweet 16 (Duke vs St. John's)",
  },
  {
    id: "s16-east-2",
    round: "sweet16",
    region: "East",
    team1Id: "michiganstate",
    team2Id: "uconn",
    team1SourceGameId: null,
    team2SourceGameId: null,
    feedsIntoGameId: "e8-east",
    feedsIntoSlot: "team2",
    pointsValue: 4,
    label: "East Sweet 16 (Michigan State vs UConn)",
  },

  // South
  {
    id: "s16-south-1",
    round: "sweet16",
    region: "South",
    team1Id: "iowa",
    team2Id: "nebraska",
    team1SourceGameId: null,
    team2SourceGameId: null,
    feedsIntoGameId: "e8-south",
    feedsIntoSlot: "team1",
    pointsValue: 4,
    label: "South Sweet 16 (Iowa vs Nebraska)",
  },
  {
    id: "s16-south-2",
    round: "sweet16",
    region: "South",
    team1Id: "illinois",
    team2Id: "houston",
    team1SourceGameId: null,
    team2SourceGameId: null,
    feedsIntoGameId: "e8-south",
    feedsIntoSlot: "team2",
    pointsValue: 4,
    label: "South Sweet 16 (Illinois vs Houston)",
  },

  // West
  {
    id: "s16-west-1",
    round: "sweet16",
    region: "West",
    team1Id: "arizona",
    team2Id: "arkansas",
    team1SourceGameId: null,
    team2SourceGameId: null,
    feedsIntoGameId: "e8-west",
    feedsIntoSlot: "team1",
    pointsValue: 4,
    label: "West Sweet 16 (Arizona vs Arkansas)",
  },
  {
    id: "s16-west-2",
    round: "sweet16",
    region: "West",
    team1Id: "texas",
    team2Id: "purdue",
    team1SourceGameId: null,
    team2SourceGameId: null,
    feedsIntoGameId: "e8-west",
    feedsIntoSlot: "team2",
    pointsValue: 4,
    label: "West Sweet 16 (Texas vs Purdue)",
  },

  // Midwest
  {
    id: "s16-midwest-1",
    round: "sweet16",
    region: "Midwest",
    team1Id: "michigan",
    team2Id: "alabama",
    team1SourceGameId: null,
    team2SourceGameId: null,
    feedsIntoGameId: "e8-midwest",
    feedsIntoSlot: "team1",
    pointsValue: 4,
    label: "Midwest Sweet 16 (Michigan vs Alabama)",
  },
  {
    id: "s16-midwest-2",
    round: "sweet16",
    region: "Midwest",
    team1Id: "tennessee",
    team2Id: "iowastate",
    team1SourceGameId: null,
    team2SourceGameId: null,
    feedsIntoGameId: "e8-midwest",
    feedsIntoSlot: "team2",
    pointsValue: 4,
    label: "Midwest Sweet 16 (Tennessee vs Iowa State)",
  },

  // ── Elite 8 ───────────────────────────────────────────────────────────────

  {
    id: "e8-east",
    round: "elite8",
    region: "East",
    team1Id: null,
    team2Id: null,
    team1SourceGameId: "s16-east-1",
    team2SourceGameId: "s16-east-2",
    feedsIntoGameId: "ff-1",
    feedsIntoSlot: "team1",
    pointsValue: 8,
    label: "East Regional Final (Elite 8)",
  },
  {
    id: "e8-south",
    round: "elite8",
    region: "South",
    team1Id: null,
    team2Id: null,
    team1SourceGameId: "s16-south-1",
    team2SourceGameId: "s16-south-2",
    feedsIntoGameId: "ff-1",
    feedsIntoSlot: "team2",
    pointsValue: 8,
    label: "South Regional Final (Elite 8)",
  },
  {
    id: "e8-west",
    round: "elite8",
    region: "West",
    team1Id: null,
    team2Id: null,
    team1SourceGameId: "s16-west-1",
    team2SourceGameId: "s16-west-2",
    feedsIntoGameId: "ff-2",
    feedsIntoSlot: "team1",
    pointsValue: 8,
    label: "West Regional Final (Elite 8)",
  },
  {
    id: "e8-midwest",
    round: "elite8",
    region: "Midwest",
    team1Id: null,
    team2Id: null,
    team1SourceGameId: "s16-midwest-1",
    team2SourceGameId: "s16-midwest-2",
    feedsIntoGameId: "ff-2",
    feedsIntoSlot: "team2",
    pointsValue: 8,
    label: "Midwest Regional Final (Elite 8)",
  },

  // ── Final Four ─────────────────────────────────────────────────────────────

  {
    id: "ff-1",
    round: "final4",
    region: "FinalFour",
    team1Id: null,
    team2Id: null,
    team1SourceGameId: "e8-east",
    team2SourceGameId: "e8-south",
    feedsIntoGameId: "championship",
    feedsIntoSlot: "team1",
    pointsValue: 16,
    label: "Final Four (East vs South)",
  },
  {
    id: "ff-2",
    round: "final4",
    region: "FinalFour",
    team1Id: null,
    team2Id: null,
    team1SourceGameId: "e8-west",
    team2SourceGameId: "e8-midwest",
    feedsIntoGameId: "championship",
    feedsIntoSlot: "team2",
    pointsValue: 16,
    label: "Final Four (West vs Midwest)",
  },

  // ── Championship ──────────────────────────────────────────────────────────

  {
    id: "championship",
    round: "championship",
    region: "Championship",
    team1Id: null,
    team2Id: null,
    team1SourceGameId: "ff-1",
    team2SourceGameId: "ff-2",
    feedsIntoGameId: null,
    feedsIntoSlot: null,
    pointsValue: 32,
    label: "National Championship",
  },
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}
