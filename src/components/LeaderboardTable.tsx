"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildLeaderboard, TOURNAMENT_ROUNDS } from "@/lib/golf";
import type { Database } from "@/lib/supabase/types";

type Team = Database["public"]["Tables"]["teams"]["Row"] & {
  player_1: { name: string } | null;
  player_2: { name: string } | null;
};
type TournamentScore = Database["public"]["Tables"]["tournament_scores"]["Row"];

export default function LeaderboardTable({
  seasonId,
  teams,
  initialScores,
}: {
  seasonId: string;
  teams: Team[];
  initialScores: TournamentScore[];
}) {
  const [scores, setScores] = useState(initialScores);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tournament_scores_${seasonId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_scores", filter: `season_id=eq.${seasonId}` },
        () => {
          supabase
            .from("tournament_scores")
            .select("*")
            .eq("season_id", seasonId)
            .then(({ data }) => setScores(data ?? []));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seasonId]);

  const rows = buildLeaderboard(teams, scores);
  const hasTie = rows.some((r) => r.isTiedForLead);

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <th className="py-1.5 pr-2">Team</th>
            {Array.from({ length: TOURNAMENT_ROUNDS }, (_, i) => (
              <th key={i} className="py-1.5 pr-2">
                R{i + 1}
              </th>
            ))}
            <th className="py-1.5 pr-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.team.id} className={`border-b border-neutral-100 dark:border-neutral-800 ${i === 0 ? "font-semibold" : ""}`}>
              <td className="py-1.5 pr-2">
                {row.team.player_1?.name ?? "?"} &amp; {row.team.player_2?.name ?? "?"}
                {row.isTiedForLead && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    tied
                  </span>
                )}
              </td>
              {[1, 2, 3].map((rn) => (
                <td key={rn} className="py-1.5 pr-2">
                  {row.scoresByRound[rn] ?? "—"}
                </td>
              ))}
              <td className="py-1.5 pr-2">{row.roundsEntered > 0 ? row.totalStrokes : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasTie && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Tied for first after all 3 rounds — settle it with the 9-hole playoff.
        </p>
      )}
    </div>
  );
}
