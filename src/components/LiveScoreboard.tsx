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

  if (!loading && games.length === 0) return null;

  const sorted = [
    ...games.filter((g) => g.statusState === "in"),
    ...games.filter((g) => g.statusState === "pre"),
    ...games.filter((g) => g.statusState === "post"),
  ];

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
      <span className="live-dot shrink-0 mr-2" />
      {loading ? (
        <span className="text-xs text-slate-600">Loading…</span>
      ) : (
        sorted.map((g, i) => <GameChip key={g.espnId} game={g} sep={i > 0} />)
      )}
    </div>
  );
}

function GameChip({ game, sep }: { game: GameScore; sep: boolean }) {
  const isLive = game.statusState === "in";
  const isFinal = game.statusState === "post";
  const showScore = isLive || isFinal;

  return (
    <>
      {sep && <span className="text-slate-700 mx-1.5 shrink-0 select-none">·</span>}
      <span className="shrink-0 flex items-center gap-1 text-xs whitespace-nowrap">
        {isLive && <span className="live-dot" />}
        <span className={isFinal ? "text-slate-500" : isLive ? "text-white" : "text-slate-400"}>
          {game.team1Name}
          {showScore && game.team1Score != null && (
            <span className="font-bold tabular-nums ml-0.5">&nbsp;{game.team1Score}</span>
          )}
        </span>
        <span className="text-slate-700">–</span>
        <span className={isFinal ? "text-slate-500" : isLive ? "text-white" : "text-slate-400"}>
          {showScore && game.team2Score != null && (
            <span className="font-bold tabular-nums mr-0.5">{game.team2Score}&nbsp;</span>
          )}
          {game.team2Name}
        </span>
        <span className={`ml-0.5 ${isLive ? "text-emerald-400" : "text-slate-600"}`}>
          {isLive ? game.statusDetail : isFinal ? "F" : game.timeDisplay}
        </span>
      </span>
    </>
  );
}
