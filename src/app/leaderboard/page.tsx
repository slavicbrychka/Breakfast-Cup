import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-profile";
import { TOURNAMENT_ROUNDS } from "@/lib/golf";
import LeaderboardTable from "@/components/LeaderboardTable";
import { submitScore } from "./actions";

export default async function LeaderboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return <p className="text-neutral-600">No season is active yet.</p>;
  }

  const [{ data: teams }, { data: scores }] = await Promise.all([
    supabase
      .from("teams")
      .select("*, player_1:profiles!teams_player_1_id_fkey(name), player_2:profiles!teams_player_2_id_fkey(name)")
      .eq("season_id", season.id),
    supabase.from("tournament_scores").select("*").eq("season_id", season.id),
  ]);

  const myTeam = (teams ?? []).find(
    (t) => t.player_1_id === profile.id || t.player_2_id === profile.id
  );

  const myTeamScores = myTeam ? (scores ?? []).filter((s) => s.team_id === myTeam.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold">Tournament Leaderboard</h1>
        <p className="text-sm text-neutral-500">
          {season.year} — blue tees, 2-player scramble best ball, {TOURNAMENT_ROUNDS} rounds / 54 holes.
        </p>
      </div>

      {!teams || teams.length === 0 ? (
        <p className="text-neutral-600">Teams haven&apos;t been generated yet.</p>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <LeaderboardTable seasonId={season.id} teams={teams} initialScores={scores ?? []} />
        </div>
      )}

      {myTeam && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Enter your team&apos;s scores</h2>
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: TOURNAMENT_ROUNDS }, (_, i) => i + 1).map((roundNumber) => {
              const existing = myTeamScores.find((s) => s.round_number === roundNumber);
              return (
                <form key={roundNumber} action={submitScore} className="flex flex-col text-sm">
                  <input type="hidden" name="team_id" value={myTeam.id} />
                  <input type="hidden" name="season_id" value={season.id} />
                  <input type="hidden" name="round_number" value={roundNumber} />
                  Round {roundNumber}
                  <div className="mt-1 flex gap-1">
                    <input
                      name="strokes"
                      type="number"
                      min={1}
                      defaultValue={existing?.strokes ?? ""}
                      placeholder="strokes"
                      className="w-24 rounded-md border border-neutral-300 px-2 py-1.5"
                    />
                    <button type="submit" className="rounded-md bg-green-700 px-3 py-1.5 text-white hover:bg-green-800">
                      Save
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
