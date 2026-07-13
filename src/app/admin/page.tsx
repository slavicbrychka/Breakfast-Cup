import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-profile";
import { calcHandicap } from "@/lib/golf";
import {
  createSeason,
  setSeasonStatus,
  updatePlayerRole,
  generateTeams,
  updateTeamPlayer,
  completeSeason,
} from "./actions";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: seasons }, { data: profiles }] = await Promise.all([
    supabase.from("seasons").select("*").order("year", { ascending: false }),
    supabase.from("profiles").select("*").order("name"),
  ]);

  const currentSeason = seasons?.[0] ?? null;

  const { data: rounds } = currentSeason
    ? await supabase.from("rounds").select("*").eq("season_id", currentSeason.id)
    : { data: [] };

  const { data: teams } = currentSeason
    ? await supabase
        .from("teams")
        .select("*, player_1:profiles!teams_player_1_id_fkey(name), player_2:profiles!teams_player_2_id_fkey(name)")
        .eq("season_id", currentSeason.id)
    : { data: [] };

  const rosterWithHandicap = (profiles ?? []).map((p) => ({
    profile: p,
    handicap: calcHandicap((rounds ?? []).filter((r) => r.user_id === p.id)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 font-semibold">Start a new season</h2>
        <form action={createSeason} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">
            Year
            <input
              name="year"
              type="number"
              required
              placeholder="2026"
              className="w-28 rounded-md border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <label className="flex flex-col text-sm">
            Qualifying opens
            <input name="qualification_start" type="date" className="rounded-md border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900" />
          </label>
          <label className="flex flex-col text-sm">
            Qualifying closes
            <input name="qualification_end" type="date" className="rounded-md border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900" />
          </label>
          <button type="submit" className="rounded-md bg-green-700 px-4 py-1.5 font-medium text-white hover:bg-green-800">
            Create season
          </button>
        </form>
      </section>

      {currentSeason && (
        <>
          <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-3 font-semibold">
              {currentSeason.year} season — status: <span className="font-mono">{currentSeason.status}</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {(["qualifying", "teams_set", "in_progress", "completed"] as const).map((status) => (
                <form key={status} action={setSeasonStatus}>
                  <input type="hidden" name="season_id" value={currentSeason.id} />
                  <input type="hidden" name="status" value={status} />
                  <button
                    type="submit"
                    disabled={currentSeason.status === status}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 hover:border-green-700 dark:border-neutral-700 dark:hover:border-green-500"
                  >
                    Set: {status}
                  </button>
                </form>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Set to <code>qualifying</code> to keep the round-logging window open, or any other status to lock it.
            </p>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-3 font-semibold">Generate teams</h2>
            <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
              Sorts all qualified players by handicap and pairs lowest with highest. Re-running replaces the
              current teams for this season.
            </p>
            <form action={generateTeams}>
              <input type="hidden" name="season_id" value={currentSeason.id} />
              <button type="submit" className="rounded-md bg-green-700 px-4 py-1.5 font-medium text-white hover:bg-green-800">
                Generate teams
              </button>
            </form>

            {teams && teams.length > 0 && (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    <th className="py-1.5 pr-2">Player 1</th>
                    <th className="py-1.5 pr-2">Player 2</th>
                    <th className="py-1.5">Swap</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.id} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="py-1.5 pr-2">
                        <form action={updateTeamPlayer} className="flex items-center gap-1">
                          <input type="hidden" name="team_id" value={t.id} />
                          <input type="hidden" name="slot" value="player_1_id" />
                          <select name="player_id" defaultValue={t.player_1_id} className="rounded border border-neutral-300 px-1 py-0.5 dark:border-neutral-700 dark:bg-neutral-900">
                            {(profiles ?? []).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="text-xs text-green-700 underline dark:text-green-400">
                            save
                          </button>
                        </form>
                      </td>
                      <td className="py-1.5 pr-2">
                        <form action={updateTeamPlayer} className="flex items-center gap-1">
                          <input type="hidden" name="team_id" value={t.id} />
                          <input type="hidden" name="slot" value="player_2_id" />
                          <select name="player_id" defaultValue={t.player_2_id} className="rounded border border-neutral-300 px-1 py-0.5 dark:border-neutral-700 dark:bg-neutral-900">
                            {(profiles ?? []).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="text-xs text-green-700 underline dark:text-green-400">
                            save
                          </button>
                        </form>
                      </td>
                      <td className="py-1.5 text-xs text-neutral-400 dark:text-neutral-500">manual override</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-3 font-semibold">Complete season &amp; archive trophy</h2>
            <form action={completeSeason} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="season_id" value={currentSeason.id} />
              <label className="flex flex-col text-sm">
                Winning team
                <input
                  name="winning_team_names"
                  type="text"
                  required
                  placeholder="Dave & Mike"
                  className="rounded-md border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <label className="flex flex-col text-sm">
                Photo URL (optional)
                <input name="photo_url" type="url" placeholder="https://…" className="rounded-md border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900" />
              </label>
              <button type="submit" className="rounded-md bg-amber-700 px-4 py-1.5 font-medium text-white hover:bg-amber-800">
                Archive &amp; complete
              </button>
            </form>
          </section>
        </>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 font-semibold">Manage players</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <th className="py-1.5 pr-2">Name</th>
              <th className="py-1.5 pr-2">Email</th>
              <th className="py-1.5 pr-2">Handicap</th>
              <th className="py-1.5 pr-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {rosterWithHandicap.map(({ profile: p, handicap }) => (
              <tr key={p.id} className="border-b border-neutral-100 dark:border-neutral-800">
                <td className="py-1.5 pr-2">{p.name}</td>
                <td className="py-1.5 pr-2 text-neutral-500 dark:text-neutral-400">{p.email}</td>
                <td className="py-1.5 pr-2">{handicap != null ? handicap.toFixed(1) : "—"}</td>
                <td className="py-1.5 pr-2">
                  <form action={updatePlayerRole} className="flex items-center gap-1">
                    <input type="hidden" name="user_id" value={p.id} />
                    <select name="role" defaultValue={p.role} className="rounded border border-neutral-300 px-1 py-0.5 dark:border-neutral-700 dark:bg-neutral-900">
                      <option value="player">player</option>
                      <option value="admin">admin</option>
                    </select>
                    <button type="submit" className="text-xs text-green-700 underline dark:text-green-400">
                      save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
