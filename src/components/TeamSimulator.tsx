"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  calcDisplayHandicap,
  simulateTeams,
  calcWinOdds,
  SCRAMBLE_FACTOR,
  TOURNAMENT_ROUNDS,
  type PlayerWithHandicap,
} from "@/lib/golf";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Round = Database["public"]["Tables"]["rounds"]["Row"];

export default function TeamSimulator({
  seasonId,
  profiles,
  initialRounds,
}: {
  seasonId: string;
  profiles: Profile[];
  initialRounds: Round[];
}) {
  const [rounds, setRounds] = useState(initialRounds);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`team_simulator_${seasonId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `season_id=eq.${seasonId}` },
        () => {
          supabase
            .from("rounds")
            .select("*")
            .eq("season_id", seasonId)
            .then(({ data }) => setRounds(data ?? []));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seasonId]);

  const provisionalByPlayer = new Map<string, boolean>();
  const players: PlayerWithHandicap[] = profiles
    .map((profile) => {
      const playerRounds = rounds.filter((r) => r.user_id === profile.id);
      const display = calcDisplayHandicap(playerRounds);
      if (display == null) return null;
      provisionalByPlayer.set(profile.id, display.provisional);
      return { profile, handicap: display.value };
    })
    .filter((p): p is PlayerWithHandicap => p !== null);

  const unpaired = players.length % 2 === 1;
  const teams = simulateTeams(players);
  const odds = calcWinOdds(teams);

  if (players.length < 2) {
    return (
      <p className="text-neutral-600 dark:text-neutral-400">
        Need at least 2 players with a logged round to simulate teams.
      </p>
    );
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <th className="py-1.5 pr-2">Team</th>
            <th className="py-1.5 pr-2">Combined HCP</th>
            <th className="py-1.5 pr-2">Predicted (54 holes)</th>
            <th className="py-1.5 pr-2">O/U line</th>
            <th className="py-1.5 pr-2">Win odds</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, i) => {
            const [a, b] = team.players;
            const provisional = provisionalByPlayer.get(a.profile.id) || provisionalByPlayer.get(b.profile.id);
            const line = team.predictedDifferential;
            return (
              <tr key={`${a.profile.id}-${b.profile.id}`} className="border-b border-neutral-100 dark:border-neutral-800">
                <td className="py-1.5 pr-2">
                  {a.profile.name} &amp; {b.profile.name}
                  {provisional && (
                    <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">*</span>
                  )}
                </td>
                <td className="py-1.5 pr-2">{team.combinedHandicap.toFixed(1)}</td>
                <td className="py-1.5 pr-2">
                  {line > 0 ? "+" : ""}
                  {line.toFixed(1)}
                </td>
                <td className="py-1.5 pr-2">
                  O/U {line.toFixed(1)} (-110/-110)
                </td>
                <td className="py-1.5 pr-2 font-medium">{odds[i]?.americanOdds}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Rough for-fun estimate: pairs players the same way real team generation would (lowest handicap with
        highest), then assumes a two-player scramble plays about {Math.round(SCRAMBLE_FACTOR * 100)}% of the
        team&apos;s combined handicap over par per round across {TOURNAMENT_ROUNDS} rounds. Not a real forecast —
        updates live as rounds are logged.
        {unpaired && " One player is currently unpaired (odd number of qualified players)."}
        {provisionalByPlayer.size > 0 && [...provisionalByPlayer.values()].some(Boolean) && (
          <> * = includes a provisional (1-round) handicap.</>
        )}
      </p>
    </div>
  );
}
