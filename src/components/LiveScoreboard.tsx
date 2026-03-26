"use client";

import { useEffect, useState } from "react";

interface GameScore {
  espnId: string;
  team1Name: string;
  team2Name: string;
  team1Score: number | null;
  team2Score: number | null;
  statusState: string;
  statusDetail: string;
  timeDisplay: string;
}

export function LiveScoreboard() {
  const [games, setGames] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchScores() {
    try {
      const res = await fetch("/api/live-scores", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { games: GameScore[] };
      setGames(data.games ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchScores();
    const id = setInterval(fetchScores, 30_000);
    return () => clearInterval(id);
  }, []);

  // Only show if there are games today/recent
  const liveGames = games.filter((g) => g.statusState === "in");
  const recentGames = games.filter((g) => g.statusState === "post");
  const upcomingGames = games.filter((g) => g.statusState === "pre");

  // Nothing to show
  if (!loading && games.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
        <span className="live-dot" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Scoreboard
        </span>
      </div>

      {loading ? (
        <div className="px-4 py-3 text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="divide-y divide-slate-800/50">
          {/* Live games first */}
          {liveGames.map((g) => (
            <ScoreRow key={g.espnId} game={g} highlight />
          ))}
          {/* Upcoming today */}
          {upcomingGames.map((g) => (
            <ScoreRow key={g.espnId} game={g} />
          ))}
          {/* Recently finished */}
          {recentGames.map((g) => (
            <ScoreRow key={g.espnId} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreRow({
  game,
  highlight,
}: {
  game: GameScore;
  highlight?: boolean;
}) {
  const isLive = game.statusState === "in";
  const isFinal = game.statusState === "post";

  return (
    <div
      className={`px-4 py-2.5 flex items-center gap-3 text-sm ${
        highlight ? "bg-emerald-950/30" : ""
      }`}
    >
      {/* Status badge */}
      <div className="w-14 shrink-0 text-center">
        {isLive ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <span className="live-dot" />
            {game.statusDetail}
          </span>
        ) : isFinal ? (
          <span className="text-xs text-slate-500 font-medium">Final</span>
        ) : (
          <span className="text-xs text-slate-500">{game.timeDisplay}</span>
        )}
      </div>

      {/* Teams and scores */}
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <TeamLine
          name={game.team1Name}
          score={game.team1Score}
          isLive={isLive || isFinal}
          won={
            isFinal &&
            game.team1Score != null &&
            game.team2Score != null &&
            game.team1Score > game.team2Score
          }
        />
        <TeamLine
          name={game.team2Name}
          score={game.team2Score}
          isLive={isLive || isFinal}
          won={
            isFinal &&
            game.team1Score != null &&
            game.team2Score != null &&
            game.team2Score > game.team1Score
          }
        />
      </div>
    </div>
  );
}

function TeamLine({
  name,
  score,
  isLive,
  won,
}: {
  name: string;
  score: number | null;
  isLive: boolean;
  won: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={`truncate ${won ? "text-white font-semibold" : "text-slate-400"}`}
      >
        {name}
      </span>
      {isLive && score != null && (
        <span
          className={`tabular-nums font-bold shrink-0 ${won ? "text-white" : "text-slate-400"}`}
        >
          {score}
        </span>
      )}
    </div>
  );
}
