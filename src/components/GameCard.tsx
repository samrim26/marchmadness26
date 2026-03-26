import type { Game, Results } from "@/lib/types";
import { getTeamName } from "@/data/teams";
import { getGameParticipant } from "@/lib/bracket";

interface Props {
  game: Game;
  results: Results;
}

export function GameCard({ game, results }: Props) {
  const t1 = getGameParticipant(game, "team1", results);
  const t2 = getGameParticipant(game, "team2", results);
  const winner = results[game.id];
  const isComplete = !!winner;

  // Short descriptor: "East · Sweet 16"
  const roundShort = game.label.includes("Sweet 16")
    ? "Sweet 16"
    : game.label.includes("Elite")
    ? "Elite 8"
    : game.label.includes("Final Four")
    ? "Final Four"
    : game.label.includes("Championship")
    ? "Championship"
    : game.label;

  const regionMatch = game.label.match(/\(([A-Za-z]+)/);
  const region = regionMatch?.[1] ?? "";

  return (
    <div className="card p-4 space-y-3">
      {/* Round label */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium">
          {region ? `${region} · ` : ""}{roundShort}
        </span>
        {isComplete && (
          <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">Final</span>
        )}
      </div>

      {/* Teams stacked */}
      <div className="space-y-1.5">
        <TeamSlot teamId={t1} isWinner={winner === t1} isLoser={isComplete && winner !== t1} />
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-slate-800/60" />
          <span className="text-[10px] text-slate-700 font-medium tracking-wider">VS</span>
          <div className="flex-1 h-px bg-slate-800/60" />
        </div>
        <TeamSlot teamId={t2} isWinner={winner === t2} isLoser={isComplete && winner !== t2} />
      </div>

      {/* Winner callout */}
      {isComplete && (
        <div className="text-xs text-emerald-400 font-medium">
          ✓ {getTeamName(winner)} wins
        </div>
      )}
    </div>
  );
}

function TeamSlot({
  teamId,
  isWinner,
  isLoser,
}: {
  teamId: string | null;
  isWinner: boolean;
  isLoser: boolean;
}) {
  const name = teamId ? getTeamName(teamId) : "TBD";

  return (
    <div
      className={`rounded-lg px-3 py-2 text-sm font-medium text-center transition-colors ${
        isWinner
          ? "bg-emerald-900/40 text-emerald-200 ring-1 ring-emerald-600/30"
          : isLoser
          ? "bg-slate-800/20 text-slate-600 line-through"
          : teamId
          ? "bg-slate-800/50 text-slate-200"
          : "bg-slate-800/20 text-slate-600 italic text-xs"
      }`}
    >
      {name}
    </div>
  );
}
