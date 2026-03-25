import type { Metadata } from "next";
import { GAMES } from "@/data/games";
import { TEAMS } from "@/data/teams";
import { getResults } from "@/lib/getResults";
import { getManualOdds } from "@/lib/manualOdds";
import { getGameParticipant } from "@/lib/bracket";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin | March Madness 2026",
};

export default async function AdminPage() {
  const results = await getResults();
  const initialOdds = await getManualOdds();

  const teamName = (id: string | null) =>
    id ? (TEAMS.find((t) => t.id === id)?.name ?? id) : null;

  const rows = GAMES.map((game) => {
    const t1Id = getGameParticipant(game, "team1", results);
    const t2Id = getGameParticipant(game, "team2", results);
    return {
      game,
      team1Id: t1Id,
      team1Name: teamName(t1Id),
      team2Id: t2Id,
      team2Name: teamName(t2Id),
      winner: results[game.id] ?? null,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin — Record Results</h1>
        <p className="text-slate-400 mt-1">
          Click a team name to record them as the winner. All pages update instantly.
        </p>
      </div>
      <AdminClient initialResults={results} rows={rows} initialOdds={initialOdds} />
    </div>
  );
}
