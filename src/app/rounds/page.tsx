import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-profile";
import { calcHandicap, roundDifferential, MIN_QUALIFYING_ROUNDS } from "@/lib/golf";
import { addRound, deleteRound } from "./actions";

export default async function RoundsPage() {
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

  const locked = season.status !== "qualifying";

  const [{ data: allProfiles }, { data: allRounds }] = await Promise.all([
    supabase.from("profiles").select("*").order("name"),
    supabase.from("rounds").select("*").eq("season_id", season.id).order("date", { ascending: false }),
  ]);

  const profiles = allProfiles ?? [];
  const rounds = allRounds ?? [];
  const myRounds = rounds.filter((r) => r.user_id === profile.id);

  const roster = profiles
    .map((p) => {
      const playerRounds = rounds.filter((r) => r.user_id === p.id);
      return { profile: p, handicap: calcHandicap(playerRounds), roundCount: playerRounds.length };
    })
    .sort((a, b) => {
      if (a.handicap == null && b.handicap == null) return a.profile.name.localeCompare(b.profile.name);
      if (a.handicap == null) return 1;
      if (b.handicap == null) return -1;
      return a.handicap - b.handicap;
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold">Qualifying Rounds</h1>
        <p className="text-sm text-neutral-500">
          White tees. Best {MIN_QUALIFYING_ROUNDS} of your rounds count toward your handicap.
          {locked && " Qualifying is currently locked."}
        </p>
      </div>

      {!locked && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">Log a round</h2>
          <form action={addRound} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="season_id" value={season.id} />
            <label className="flex flex-col text-sm">
              Date
              <input
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="rounded-md border border-neutral-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col text-sm">
              Course par
              <input
                name="course_par"
                type="number"
                required
                min={27}
                max={90}
                placeholder="72"
                className="w-24 rounded-md border border-neutral-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col text-sm">
              Your score
              <input
                name="score"
                type="number"
                required
                min={1}
                placeholder="88"
                className="w-24 rounded-md border border-neutral-300 px-2 py-1.5"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-green-700 px-4 py-1.5 font-medium text-white hover:bg-green-800"
            >
              Add round
            </button>
          </form>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Your rounds</h2>
        {myRounds.length === 0 ? (
          <p className="text-neutral-600">No rounds logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-1.5 pr-2">Date</th>
                <th className="py-1.5 pr-2">Par</th>
                <th className="py-1.5 pr-2">Score</th>
                <th className="py-1.5 pr-2">+/-</th>
                {!locked && <th className="py-1.5"></th>}
              </tr>
            </thead>
            <tbody>
              {myRounds.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="py-1.5 pr-2">{r.date}</td>
                  <td className="py-1.5 pr-2">{r.course_par}</td>
                  <td className="py-1.5 pr-2">{r.score}</td>
                  <td className="py-1.5 pr-2">
                    {roundDifferential(r) > 0 ? "+" : ""}
                    {roundDifferential(r)}
                  </td>
                  {!locked && (
                    <td className="py-1.5">
                      <form action={deleteRound}>
                        <input type="hidden" name="round_id" value={r.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">
                          Remove
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Everyone&apos;s handicap (read-only)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-1.5 pr-2">Player</th>
              <th className="py-1.5 pr-2">Rounds</th>
              <th className="py-1.5 pr-2">Handicap</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.profile.id} className="border-b border-neutral-100">
                <td className="py-1.5 pr-2">{r.profile.name}</td>
                <td className="py-1.5 pr-2">{r.roundCount}</td>
                <td className="py-1.5 pr-2">{r.handicap != null ? r.handicap.toFixed(1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
