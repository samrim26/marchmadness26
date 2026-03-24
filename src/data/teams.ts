import type { Team } from "@/lib/types";

/**
 * All 16 teams in the Sweet 16 (2026 NCAA Tournament).
 * Update seeds if the official bracket differs.
 */
export const TEAMS: Team[] = [
  // East Region
  { id: "duke", name: "Duke", seed: 1, region: "East" },
  { id: "stjohns", name: "St. John's", seed: 2, region: "East" },
  { id: "michiganstate", name: "Michigan State", seed: 3, region: "East" },
  { id: "uconn", name: "UConn", seed: 4, region: "East" },

  // South Region
  { id: "iowa", name: "Iowa", seed: 2, region: "South" },
  { id: "nebraska", name: "Nebraska", seed: 6, region: "South" },
  { id: "illinois", name: "Illinois", seed: 3, region: "South" },
  { id: "houston", name: "Houston", seed: 1, region: "South" },

  // West Region
  { id: "arizona", name: "Arizona", seed: 1, region: "West" },
  { id: "arkansas", name: "Arkansas", seed: 5, region: "West" },
  { id: "texas", name: "Texas", seed: 2, region: "West" },
  { id: "purdue", name: "Purdue", seed: 4, region: "West" },

  // Midwest Region
  { id: "michigan", name: "Michigan", seed: 3, region: "Midwest" },
  { id: "alabama", name: "Alabama", seed: 2, region: "Midwest" },
  { id: "tennessee", name: "Tennessee", seed: 1, region: "Midwest" },
  { id: "iowastate", name: "Iowa State", seed: 6, region: "Midwest" },
];

export function getTeam(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}

export function getTeamName(id: string): string {
  return TEAMS.find((t) => t.id === id)?.name ?? id;
}
