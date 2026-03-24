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

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">
        {game.label}
      </div>
      <div className="flex items-center gap-2">
        <TeamSlot
          teamId={t1}
          isWinner={winner === t1}
          isLoser={isComplete && winner !== t1}
        />
        <span className="text-slate-600 text-xs">vs</span>
        <TeamSlot
          teamId={t2}
          isWinner={winner === t2}
          isLoser={isComplete && winner !== t2}
        />
      </div>
      {isComplete && (
        <div className="mt-2 text-xs text-emerald-400">
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
    <span
      className={`flex-1 rounded px-2 py-1 text-sm font-medium text-center transition-colors ${
        isWinner
          ? "bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-500/40"
          : isLoser
          ? "bg-slate-800/40 text-slate-500 line-through"
          : teamId
          ? "bg-slate-800/60 text-slate-200"
          : "bg-slate-800/30 text-slate-600 italic"
      }`}
    >
      {name}
    </span>
  );
}
