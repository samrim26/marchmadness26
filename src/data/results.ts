import type { Results } from "@/lib/types";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  HOW TO UPDATE RESULTS                                       ║
 * ║  Add an entry: gameId -> winnerId                            ║
 * ║  Remove an entry to un-complete a game (for corrections)     ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Game IDs (Sweet 16 → Championship):
 *   Sweet 16:    s16-east-1  s16-east-2  s16-south-1  s16-south-2
 *                s16-west-1  s16-west-2  s16-midwest-1  s16-midwest-2
 *   Elite 8:     e8-east     e8-south    e8-west    e8-midwest
 *   Final Four:  ff-1        ff-2
 *   Championship: championship
 *
 * Team IDs:
 *   East:    duke, stjohns, michiganstate, uconn
 *   South:   iowa, nebraska, illinois, houston
 *   West:    arizona, arkansas, texas, purdue
 *   Midwest: michigan, alabama, tennessee, iowastate
 *
 * Example — after Duke beats St. John's:
 *   "s16-east-1": "duke",
 */
export const RESULTS: Results = {
  // Paste completed results here, e.g.:
  // "s16-east-1": "duke",
  // "s16-east-2": "uconn",
};
