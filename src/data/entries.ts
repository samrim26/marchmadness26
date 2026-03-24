import type { Entry } from "@/lib/types";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  HOW TO ADD / EDIT BRACKET ENTRIES                          ║
 * ║  Each entry needs a unique id, a display name, and picks    ║
 * ║  for every game id (Sweet 16 through Championship).         ║
 * ║                                                             ║
 * ║  Picks are keyed by game id → predicted winner team id.     ║
 * ║  A pick earns points only if that team actually wins        ║
 * ║  THAT SPECIFIC GAME (regardless of path).                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Game IDs:
 *   s16-east-1    (Duke vs St. John's)
 *   s16-east-2    (Michigan State vs UConn)
 *   e8-east       (East Regional Final)
 *   s16-south-1   (Iowa vs Nebraska)
 *   s16-south-2   (Illinois vs Houston)
 *   e8-south      (South Regional Final)
 *   s16-west-1    (Arizona vs Arkansas)
 *   s16-west-2    (Texas vs Purdue)
 *   e8-west       (West Regional Final)
 *   s16-midwest-1 (Michigan vs Alabama)
 *   s16-midwest-2 (Tennessee vs Iowa State)
 *   e8-midwest    (Midwest Regional Final)
 *   ff-1          (Final Four: East vs South)
 *   ff-2          (Final Four: West vs Midwest)
 *   championship  (National Championship)
 */
export const ENTRIES: Entry[] = [
  // ─────────────────────────────────────────────────────────────
  // Replace these entries with real bracket picks.
  // Add/remove entries freely. Order here determines tiebreak display order.
  // ─────────────────────────────────────────────────────────────

  {
    id: "sam",
    displayName: "Sam",
    picks: {
      "s16-east-1": "duke",
      "s16-east-2": "uconn",
      "e8-east": "duke",
      "s16-south-1": "iowa",
      "s16-south-2": "houston",
      "e8-south": "houston",
      "s16-west-1": "arizona",
      "s16-west-2": "texas",
      "e8-west": "arizona",
      "s16-midwest-1": "alabama",
      "s16-midwest-2": "tennessee",
      "e8-midwest": "tennessee",
      "ff-1": "duke",
      "ff-2": "arizona",
      championship: "duke",
    },
  },

  {
    id: "alex",
    displayName: "Alex",
    picks: {
      "s16-east-1": "stjohns",
      "s16-east-2": "uconn",
      "e8-east": "uconn",
      "s16-south-1": "iowa",
      "s16-south-2": "illinois",
      "e8-south": "illinois",
      "s16-west-1": "arizona",
      "s16-west-2": "purdue",
      "e8-west": "purdue",
      "s16-midwest-1": "michigan",
      "s16-midwest-2": "iowastate",
      "e8-midwest": "iowastate",
      "ff-1": "uconn",
      "ff-2": "purdue",
      championship: "uconn",
    },
  },

  {
    id: "jordan",
    displayName: "Jordan",
    picks: {
      "s16-east-1": "duke",
      "s16-east-2": "michiganstate",
      "e8-east": "duke",
      "s16-south-1": "iowa",
      "s16-south-2": "houston",
      "e8-south": "houston",
      "s16-west-1": "arizona",
      "s16-west-2": "texas",
      "e8-west": "texas",
      "s16-midwest-1": "alabama",
      "s16-midwest-2": "tennessee",
      "e8-midwest": "tennessee",
      "ff-1": "duke",
      "ff-2": "texas",
      championship: "duke",
    },
  },

  {
    id: "taylor",
    displayName: "Taylor",
    picks: {
      "s16-east-1": "duke",
      "s16-east-2": "uconn",
      "e8-east": "duke",
      "s16-south-1": "nebraska",
      "s16-south-2": "houston",
      "e8-south": "houston",
      "s16-west-1": "arizona",
      "s16-west-2": "purdue",
      "e8-west": "arizona",
      "s16-midwest-1": "michigan",
      "s16-midwest-2": "tennessee",
      "e8-midwest": "tennessee",
      "ff-1": "duke",
      "ff-2": "tennessee",
      championship: "tennessee",
    },
  },

  {
    id: "morgan",
    displayName: "Morgan",
    picks: {
      "s16-east-1": "stjohns",
      "s16-east-2": "uconn",
      "e8-east": "uconn",
      "s16-south-1": "iowa",
      "s16-south-2": "houston",
      "e8-south": "houston",
      "s16-west-1": "arizona",
      "s16-west-2": "texas",
      "e8-west": "arizona",
      "s16-midwest-1": "alabama",
      "s16-midwest-2": "iowastate",
      "e8-midwest": "alabama",
      "ff-1": "uconn",
      "ff-2": "arizona",
      championship: "arizona",
    },
  },

  {
    id: "casey",
    displayName: "Casey",
    picks: {
      "s16-east-1": "duke",
      "s16-east-2": "uconn",
      "e8-east": "uconn",
      "s16-south-1": "iowa",
      "s16-south-2": "illinois",
      "e8-south": "iowa",
      "s16-west-1": "arizona",
      "s16-west-2": "texas",
      "e8-west": "arizona",
      "s16-midwest-1": "alabama",
      "s16-midwest-2": "tennessee",
      "e8-midwest": "alabama",
      "ff-1": "uconn",
      "ff-2": "arizona",
      championship: "uconn",
    },
  },

  {
    id: "riley",
    displayName: "Riley",
    picks: {
      "s16-east-1": "duke",
      "s16-east-2": "michiganstate",
      "e8-east": "duke",
      "s16-south-1": "iowa",
      "s16-south-2": "houston",
      "e8-south": "iowa",
      "s16-west-1": "arkansas",
      "s16-west-2": "texas",
      "e8-west": "texas",
      "s16-midwest-1": "michigan",
      "s16-midwest-2": "tennessee",
      "e8-midwest": "michigan",
      "ff-1": "duke",
      "ff-2": "texas",
      championship: "duke",
    },
  },

  {
    id: "drew",
    displayName: "Drew",
    picks: {
      "s16-east-1": "stjohns",
      "s16-east-2": "uconn",
      "e8-east": "stjohns",
      "s16-south-1": "nebraska",
      "s16-south-2": "houston",
      "e8-south": "houston",
      "s16-west-1": "arizona",
      "s16-west-2": "purdue",
      "e8-west": "arizona",
      "s16-midwest-1": "alabama",
      "s16-midwest-2": "iowastate",
      "e8-midwest": "iowastate",
      "ff-1": "houston",
      "ff-2": "arizona",
      championship: "arizona",
    },
  },
];
