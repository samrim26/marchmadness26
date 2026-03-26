"use client";

import { useState } from "react";
import type { Game } from "@/lib/types";
import type { ManualGameOdds } from "@/lib/manualOdds";
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
  rows,
  initialOdds,
}: {
  initialResults: Record<string, string>; // kept for prop compatibility
  rows: GameRow[];
  initialOdds: ManualGameOdds[];
}) {
  const [password, setPassword] = useState("");
  const [odds, setOdds] = useState<ManualGameOdds[]>(initialOdds);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [oddsInputs, setOddsInputs] = useState<Record<string, { t1: string; t2: string }>>(() => {
    const init: Record<string, { t1: string; t2: string }> = {};
    for (const o of initialOdds) {
      init[o.gameId] = { t1: String(o.team1AmericanOdds), t2: String(o.team2AmericanOdds) };
    }
    return init;
  });

  async function saveOdds(gameId: string) {
    const input = oddsInputs[gameId];
    if (!input) return;
    const t1 = parseInt(input.t1, 10);
    const t2 = parseInt(input.t2, 10);
    if (isNaN(t1) || isNaN(t2)) {
      setError("Odds must be numbers like -290 or +235");
      return;
    }
    setLoading(`odds-${gameId}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/odds", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ gameId, team1AmericanOdds: t1, team2AmericanOdds: t2, bookmaker: "DraftKings" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unknown error");
      } else {
        setOdds((prev) => {
          const next = prev.filter((o) => o.gameId !== gameId);
          next.push({ gameId, team1AmericanOdds: t1, team2AmericanOdds: t2, bookmaker: "DraftKings" });
          return next;
        });
        setSuccess(`Odds saved for ${gameId}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  async function clearOdds(gameId: string) {
    setLoading(`odds-${gameId}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/odds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ gameId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Unknown error");
      } else {
        setOdds((prev) => prev.filter((o) => o.gameId !== gameId));
        setOddsInputs((prev) => { const next = { ...prev }; delete next[gameId]; return next; });
        setSuccess(`Odds cleared for ${gameId}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  const roundLabels: Record<string, string> = {
    sweet16: "Sweet 16", elite8: "Elite 8", final4: "Final Four", championship: "Championship",
  };
  const rounds = ["sweet16", "elite8", "final4", "championship"];

  // Only show rows where odds are relevant (game not yet complete, both teams known)
  const oddsRows = rows.filter((r) => !r.winner && r.team1Id && r.team2Id);

  return (
    <div className="space-y-8">
      {/* Auto-sync notice */}
      <div className="rounded-xl border border-blue-800/30 bg-blue-900/10 p-4 text-sm text-slate-300">
        <span className="font-semibold text-blue-300">Results auto-sync:</span> Game results are
        fetched automatically from ESPN every 60 seconds — no manual entry needed.
        Use this page only to override moneyline odds if the auto-synced odds are stale.
      </div>

      {/* Password */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 space-y-3 max-w-sm">
        <label className="block text-sm font-medium text-slate-300">Admin Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter ADMIN_PASSWORD"
          className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-red-400 text-sm">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-900/20 px-4 py-3 text-emerald-400 text-sm">{success}</div>
      )}

      {/* Odds override — only upcoming games with known participants */}
      {oddsRows.length === 0 ? (
        <div className="text-slate-500 text-sm">No upcoming games with known participants.</div>
      ) : (
        rounds.map((round) => {
          const roundRows = oddsRows.filter((r) => r.game.round === round);
          if (roundRows.length === 0) return null;
          return (
            <div key={round} className="space-y-3">
              <h2 className="text-lg font-semibold text-white">{roundLabels[round]}</h2>
              <div className="space-y-3">
                {roundRows.map(({ game, team1Id, team1Name, team2Id, team2Name }) => {
                  const t1Name = team1Name ?? teamName(team1Id) ?? "TBD";
                  const t2Name = team2Name ?? teamName(team2Id) ?? "TBD";
                  const savedOdds = odds.find((o) => o.gameId === game.id);
                  const oddsInput = oddsInputs[game.id] ?? { t1: "", t2: "" };
                  const isLoading = loading === `odds-${game.id}`;

                  return (
                    <div key={game.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                      <div className="text-sm font-medium text-white mb-3">{game.label}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500 w-14 shrink-0">ML Odds</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400 w-24 truncate">{t1Name}</span>
                          <input
                            type="text"
                            value={oddsInput.t1}
                            onChange={(e) =>
                              setOddsInputs((prev) => ({ ...prev, [game.id]: { ...oddsInput, t1: e.target.value } }))
                            }
                            placeholder="-110"
                            className="w-20 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 tabular-nums"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400 w-24 truncate">{t2Name}</span>
                          <input
                            type="text"
                            value={oddsInput.t2}
                            onChange={(e) =>
                              setOddsInputs((prev) => ({ ...prev, [game.id]: { ...oddsInput, t2: e.target.value } }))
                            }
                            placeholder="-110"
                            className="w-20 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 tabular-nums"
                          />
                        </div>
                        <button
                          onClick={() => saveOdds(game.id)}
                          disabled={isLoading || !password}
                          className="rounded bg-blue-700 hover:bg-blue-600 px-3 py-1 text-xs text-white transition-colors disabled:opacity-40"
                        >
                          {isLoading ? "..." : "Save"}
                        </button>
                        {savedOdds && (
                          <button
                            onClick={() => clearOdds(game.id)}
                            disabled={isLoading || !password}
                            className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40"
                          >
                            Clear
                          </button>
                        )}
                        {savedOdds && (
                          <span className="text-xs text-emerald-500 ml-1">
                            ✓ {savedOdds.team1AmericanOdds > 0 ? "+" : ""}{savedOdds.team1AmericanOdds} / {savedOdds.team2AmericanOdds > 0 ? "+" : ""}{savedOdds.team2AmericanOdds}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
