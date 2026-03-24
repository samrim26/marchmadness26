import type { Metadata } from "next";
import { GAMES } from "@/data/games";
import { ENTRIES } from "@/data/entries";
import { SCORING_SETTINGS } from "@/data/settings";

export const metadata: Metadata = {
  title: "About | March Madness 2026",
};

export default function AboutPage() {
  const remainingGames = GAMES.length;
  const maxScenarios = Math.pow(2, remainingGames);

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">About This Tracker</h1>
        <p className="text-slate-400 mt-2">
          How the analytics engine works, how to update results, and how to
          deploy.
        </p>
      </div>

      <Section title="Scoring">
        <p className="text-slate-300">
          Points are awarded for correctly predicting the winner of each game:
        </p>
        <div className="mt-3 rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-400">
                  Round
                </th>
                <th className="px-4 py-2 text-right text-xs uppercase tracking-wider text-slate-400">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {Object.entries(SCORING_SETTINGS).map(([round, pts]) => (
                <tr key={round}>
                  <td className="px-4 py-2 capitalize text-slate-300">
                    {round.replace("_", " ")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-white font-medium">
                    {pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-400 text-sm mt-3">
          Picks are stored per-game. An entry earns points for a round pick if
          their chosen team wins that specific game — regardless of which path
          the team took to get there.
        </p>
      </Section>

      <Section title="Probability Engine">
        <p className="text-slate-300 mb-3">
          This tracker uses <strong className="text-white">exact enumeration</strong>{" "}
          of all valid remaining tournament outcomes — no simulation, no
          sampling, no approximation.
        </p>
        <ul className="space-y-2 text-sm text-slate-400">
          <li>
            <span className="text-white">→</span> Starting from the current
            state, every remaining game is expanded recursively: each game's
            winner advances to the correct next-round slot.
          </li>
          <li>
            <span className="text-white">→</span> With {remainingGames} games
            remaining this produces at most{" "}
            <span className="text-white font-mono">
              2^{remainingGames} = {maxScenarios.toLocaleString()}
            </span>{" "}
            complete tournament paths.
          </li>
          <li>
            <span className="text-white">→</span> All paths are assumed equally
            likely (50/50 per game).
          </li>
          <li>
            <span className="text-white">→</span> For each path, every
            entry&apos;s final score is computed. An entry &quot;wins&quot; a
            path if its score equals the maximum score in that path.
          </li>
          <li>
            <span className="text-white">→</span> Ties are fully supported: if
            multiple entries share the top score, each gets credit for a
            tie-for-first scenario.
          </li>
        </ul>

        <div className="mt-4 rounded-lg bg-slate-900/60 border border-slate-800 p-4 text-sm font-mono text-slate-400">
          <div className="text-slate-500 mb-1">// Formulas</div>
          <div>solo_win_prob = solo_wins / N</div>
          <div>tie_prob = tie_wins / N</div>
          <div>total_prob = (solo_wins + tie_wins) / N</div>
        </div>
      </Section>

      <Section title="Max Possible Score">
        <p className="text-sm text-slate-300">
          For each remaining game, an entry&apos;s pick is &quot;still
          alive&quot; if their chosen team has not yet been eliminated from
          reaching that game. The max possible score includes current points
          plus all alive future picks.
        </p>
        <p className="text-sm text-slate-400 mt-2">
          Example: if an entry picked Duke to win the East Regional Final but
          Duke was upset in the Sweet 16, that Elite 8 pick is dead and its 8
          points are excluded from the max possible.
        </p>
      </Section>

      <Section title="Bracket Entries">
        <p className="text-sm text-slate-300">
          There are currently{" "}
          <span className="text-white font-medium">{ENTRIES.length}</span>{" "}
          entries in this pool:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ENTRIES.map((e) => (
            <span
              key={e.id}
              className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300"
            >
              {e.displayName}
            </span>
          ))}
        </div>
        <p className="text-sm text-slate-400 mt-3">
          To add or edit entries, update{" "}
          <code className="text-blue-400">src/data/entries.ts</code>. Each
          entry needs picks for all 15 game IDs.
        </p>
      </Section>

      <Section title="Updating Results">
        <p className="text-sm text-slate-300">
          Edit <code className="text-blue-400">src/data/results.ts</code> and
          add a line for each completed game:
        </p>
        <pre className="mt-3 rounded-lg bg-slate-900 border border-slate-800 p-4 text-sm text-slate-300 overflow-x-auto">
          {`// src/data/results.ts
export const RESULTS: Results = {
  "s16-east-1": "duke",       // Duke beat St. John's
  "s16-east-2": "uconn",      // UConn beat Michigan State
  // ... add more as games finish
};`}
        </pre>
        <p className="text-sm text-slate-400 mt-3">
          After saving the file, redeploy (or reload in local dev) and all
          probabilities recalculate automatically.
        </p>
      </Section>

      <Section title="Game IDs Reference">
        <div className="rounded-lg border border-slate-800 overflow-hidden text-sm">
          <table className="w-full">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-slate-400">
                  Game ID
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-slate-400">
                  Matchup
                </th>
                <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-slate-400">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {GAMES.map((g) => (
                <tr key={g.id}>
                  <td className="px-3 py-2 font-mono text-blue-400 text-xs">
                    {g.id}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{g.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                    {g.pointsValue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Deploying to Vercel">
        <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
          <li>Push the repo to GitHub.</li>
          <li>
            Import the repo in{" "}
            <span className="text-white">vercel.com/new</span>.
          </li>
          <li>
            Framework preset:{" "}
            <span className="text-white font-medium">Next.js</span> (auto-detected).
          </li>
          <li>Deploy. No environment variables needed.</li>
          <li>
            To update results: edit{" "}
            <code className="text-blue-400">src/data/results.ts</code>, commit,
            push. Vercel auto-redeploys in ~30 seconds.
          </li>
        </ol>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-white border-b border-slate-800 pb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}
