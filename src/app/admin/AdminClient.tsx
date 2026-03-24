"use client";

import { useState } from "react";
import type { Game, Results } from "@/lib/types";
import { TEAMS } from "@/data/teams";

interface GameRow {
  game: Game;
  team1Id: string | null;
  team1Name: string | null;
  team2Id: string | null;
  team2Name: string | null;
  winner: string | null;
}

const teamName = (id: string | null) =>
  id ? (TEAMS.find((t) => t.id === id)?.name ?? id) : null;

export default function AdminClient({
  initialResults,
  rows,
}: {
  initialResults: Results;
  rows: GameRow[];
}) {
  const [password, setPassword] = useState("");
  const [results, setResults] = useState<Results>(initialResults);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function recordWinner(gameId: string, winnerId: string) {
    setLoading(gameId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, gameId, winnerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unknown error");
      } else {
        setResults(data.results);
        setSuccess(`Recorded: ${gameId} → ${winnerId}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  async function clearWinner(gameId: string) {
    setLoading(gameId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/results", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, gameId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unknown error");
      } else {
        setResults(data.results);
        setSuccess(`Cleared: ${gameId}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  // Merge rows with live results state
  const liveRows = rows.map((r) => ({ ...r, winner: results[r.game.id] ?? null }));

  const roundLabels: Record<string, string> = {
    sweet16: "Sweet 16",
    elite8: "Elite 8",
    final4: "Final Four",
    championship: "Championship",
  };

  const rounds = ["sweet16", "elite8", "final4", "championship"];

  return (
    <div className="space-y-8">
      {/* Password */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 space-y-3 max-w-sm">
        <label className="block text-sm font-medium text-slate-300">
          Admin Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter ADMIN_PASSWORD"
          className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <p className="text-xs text-slate-500">
          Set <code className="text-slate-400">ADMIN_PASSWORD</code> in Vercel environment variables.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-900/20 px-4 py-3 text-emerald-400 text-sm">
          {success}
        </div>
      )}

      {/* Games by round */}
      {rounds.map((round) => {
        const roundRows = liveRows.filter((r) => r.game.round === round);
        if (roundRows.length === 0) return null;
        return (
          <div key={round} className="space-y-3">
            <h2 className="text-lg font-semibold text-white">{roundLabels[round]}</h2>
            <div className="space-y-3">
              {roundRows.map(({ game, team1Id, team1Name, team2Id, team2Name, winner }) => {
                const isLoading = loading === game.id;
                const bothKnown = team1Id && team2Id;
                const t1Name = team1Name ?? team1Id ?? "TBD";
                const t2Name = team2Name ?? team2Id ?? "TBD";

                return (
                  <div
                    key={game.id}
                    className={`rounded-xl border p-4 flex flex-wrap items-center gap-4 ${
                      winner
                        ? "border-emerald-800/40 bg-emerald-900/10"
                        : "border-slate-700 bg-slate-900/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{game.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{game.id} · {game.pointsValue} pts</div>
                    </div>

                    {!bothKnown ? (
                      <span className="text-xs text-slate-500 italic">Awaiting earlier results</span>
                    ) : winner ? (
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 text-sm font-medium">
                          Winner: {teamName(winner) ?? winner}
                        </span>
                        <button
                          onClick={() => clearWinner(game.id)}
                          disabled={isLoading}
                          className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {isLoading ? "..." : "Clear"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => recordWinner(game.id, team1Id!)}
                          disabled={isLoading || !password}
                          className="rounded-lg bg-slate-800 hover:bg-blue-700 border border-slate-600 hover:border-blue-500 px-3 py-1.5 text-sm text-white transition-colors disabled:opacity-40"
                        >
                          {isLoading ? "..." : t1Name}
                        </button>
                        <span className="text-slate-600 self-center text-xs">vs</span>
                        <button
                          onClick={() => recordWinner(game.id, team2Id!)}
                          disabled={isLoading || !password}
                          className="rounded-lg bg-slate-800 hover:bg-blue-700 border border-slate-600 hover:border-blue-500 px-3 py-1.5 text-sm text-white transition-colors disabled:opacity-40"
                        >
                          {isLoading ? "..." : t2Name}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
