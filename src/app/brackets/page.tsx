import type { Metadata } from "next";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";
import { getResults } from "@/lib/getResults";
import { isPickStillAlive } from "@/lib/bracket";
import { calculateCurrentScore } from "@/lib/scoring";
import type { Results } from "@/lib/types";

export const metadata: Metadata = { title: "Brackets | March Madness 2026" };
export const dynamic = "force-dynamic";

// Short abbreviations for display in tight cells
const ABBR: Record<string, string> = {
  duke: "Duke",
  stjohns: "STJ",
  michiganstate: "MSU",
  uconn: "UConn",
  iowa: "Iowa",
  nebraska: "Neb",
  illinois: "Ill",
  houston: "HOU",
  arizona: "ARI",
  arkansas: "ARK",
  texas: "TEX",
  purdue: "PUR",
  michigan: "Mich",
  alabama: "ALA",
  tennessee: "TENN",
  iowastate: "ISU",
};

function abbr(teamId: string): string {
  return ABBR[teamId] ?? teamId.slice(0, 4).toUpperCase();
}

type CellStatus = "correct" | "wrong" | "alive" | "dead" | "none";

function getCellStatus(
  teamId: string,
  gameId: string,
  results: Results
): CellStatus {
  if (!teamId) return "none";
  const result = results[gameId];
  if (result) {
    return result === teamId ? "correct" : "wrong";
  }
  // Game not yet played
  return isPickStillAlive(teamId, gameId, GAMES, results) ? "alive" : "dead";
}

const CELL_CLASSES: Record<CellStatus, string> = {
  correct: "bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-600/40",
  wrong: "bg-red-900/30 text-red-400 line-through opacity-70",
  alive: "bg-slate-800/60 text-slate-200",
  dead: "bg-slate-900/40 text-slate-600",
  none: "bg-slate-900/20 text-slate-700 italic",
};

// Game columns grouped by round
const ROUND_GROUPS = [
  {
    label: "Sweet 16",
    games: [
      { id: "s16-east-1", short: "E1" },
      { id: "s16-east-2", short: "E2" },
      { id: "s16-south-1", short: "S1" },
      { id: "s16-south-2", short: "S2" },
      { id: "s16-west-1", short: "W1" },
      { id: "s16-west-2", short: "W2" },
      { id: "s16-midwest-1", short: "MW1" },
      { id: "s16-midwest-2", short: "MW2" },
    ],
  },
  {
    label: "Elite 8",
    games: [
      { id: "e8-east", short: "E" },
      { id: "e8-south", short: "S" },
      { id: "e8-west", short: "W" },
      { id: "e8-midwest", short: "MW" },
    ],
  },
  {
    label: "Final Four",
    games: [
      { id: "ff-1", short: "FF1" },
      { id: "ff-2", short: "FF2" },
    ],
  },
  {
    label: "Champ",
    games: [{ id: "championship", short: "🏆" }],
  },
];

export default async function BracketsPage() {
  const RESULTS = await getResults();

  // Sort entries by current score descending
  const sortedEntries = [...ENTRIES].sort(
    (a, b) =>
      calculateCurrentScore(b, GAMES, RESULTS) -
      calculateCurrentScore(a, GAMES, RESULTS)
  );

  // Build status legend counts
  const totals = { correct: 0, wrong: 0, alive: 0, dead: 0 };
  for (const entry of sortedEntries) {
    for (const group of ROUND_GROUPS) {
      for (const { id } of group.games) {
        const pick = entry.picks[id];
        if (!pick) continue;
        const s = getCellStatus(pick, id, RESULTS);
        if (s in totals) totals[s as keyof typeof totals]++;
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Bracket Grid</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Every bracket, every pick — sorted by current score.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {(["correct", "alive", "wrong", "dead"] as CellStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${CELL_CLASSES[s]}`}>
              ABC
            </span>
            <span className="text-slate-400 capitalize">{s}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="text-xs min-w-full border-collapse">
          <thead>
            {/* Round group headers */}
            <tr className="bg-slate-900 border-b border-slate-700">
              <th className="sticky left-0 z-10 bg-slate-900 px-4 py-2 text-left text-slate-400 font-medium min-w-[130px]">
                Bracket
              </th>
              <th className="px-2 py-2 text-right text-slate-400 font-medium w-12">Pts</th>
              {ROUND_GROUPS.map((group) => (
                <th
                  key={group.label}
                  colSpan={group.games.length}
                  className="px-2 py-2 text-center text-slate-300 font-semibold border-l border-slate-700/50"
                >
                  {group.label}
                </th>
              ))}
            </tr>
            {/* Per-game sub-headers */}
            <tr className="bg-slate-900/80 border-b border-slate-800">
              <th className="sticky left-0 z-10 bg-slate-900/80 px-4 py-1.5" />
              <th className="px-2 py-1.5" />
              {ROUND_GROUPS.map((group) =>
                group.games.map(({ id, short }, gi) => (
                  <th
                    key={id}
                    className={`px-1.5 py-1.5 text-center text-slate-500 font-normal w-14 ${gi === 0 ? "border-l border-slate-700/50" : ""}`}
                    title={GAMES.find((g) => g.id === id)?.label}
                  >
                    {short}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {sortedEntries.map((entry) => {
              const score = calculateCurrentScore(entry, GAMES, RESULTS);
              return (
                <tr key={entry.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="sticky left-0 z-10 bg-slate-950 px-4 py-2 font-medium text-white whitespace-nowrap border-r border-slate-800/50">
                    {entry.displayName}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-300 font-medium">
                    {score}
                  </td>
                  {ROUND_GROUPS.map((group, gi) =>
                    group.games.map(({ id }, colIdx) => {
                      const pick = entry.picks[id];
                      const status = pick
                        ? getCellStatus(pick, id, RESULTS)
                        : "none";
                      return (
                        <td
                          key={id}
                          className={`px-1 py-1.5 text-center ${colIdx === 0 && gi > 0 ? "border-l border-slate-700/30" : ""}`}
                        >
                          {pick ? (
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${CELL_CLASSES[status]}`}
                            >
                              {abbr(pick)}
                            </span>
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Results row — show actual winners */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Actual Results
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs min-w-full">
            <tbody>
              <tr>
                <td className="pr-4 py-1 text-slate-500 whitespace-nowrap">Winner</td>
                {ROUND_GROUPS.map((group) =>
                  group.games.map(({ id }) => {
                    const winner = RESULTS[id];
                    return (
                      <td key={id} className="px-1 py-1 text-center w-14">
                        {winner ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 font-medium">
                            {abbr(winner)}
                          </span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
