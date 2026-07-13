import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-profile";
import { calcHandicap, isQualified, MIN_QUALIFYING_ROUNDS } from "@/lib/golf";

const STATUS_LABEL: Record<string, string> = {
  qualifying: "Qualifying period open",
  teams_set: "Teams are set — tournament not started",
  in_progress: "Tournament in progress",
  completed: "Season complete",
};

export default async function DashboardPage() {
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
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold">Welcome, {profile.name}</h1>
        <p className="text-neutral-600">
          No season has been created yet.{" "}
          {profile.role === "admin" ? (
            <>
              Head to the <Link href="/admin" className="text-green-700 underline">admin panel</Link> to start one.
            </>
          ) : (
            "Ask your tournament organizer to start one."
          )}
        </p>
      </div>
    );
  }

  const { data: myRounds } = await supabase
    .from("rounds")
    .select("*")
    .eq("season_id", season.id)
    .eq("user_id", profile.id);

  const rounds = myRounds ?? [];
  const handicap = calcHandicap(rounds);
  const qualified = isQualified(rounds);

  const { data: myTeam } = await supabase
    .from("teams")
    .select("*, player_1:profiles!teams_player_1_id_fkey(name), player_2:profiles!teams_player_2_id_fkey(name)")
    .eq("season_id", season.id)
    .or(`player_1_id.eq.${profile.id},player_2_id.eq.${profile.id}`)
    .maybeSingle();

  const partnerName = myTeam
    ? myTeam.player_1_id === profile.id
      ? (myTeam as unknown as { player_2: { name: string } }).player_2?.name
      : (myTeam as unknown as { player_1: { name: string } }).player_1?.name
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold">Welcome, {profile.name}</h1>
        <p className="text-sm text-neutral-500">
          {season.year} season — {STATUS_LABEL[season.status] ?? season.status}
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">Your handicap</h2>
        {handicap != null ? (
          <p className="text-3xl font-bold text-green-800">{handicap.toFixed(1)}</p>
        ) : (
          <p className="text-neutral-600">
            Not yet qualified — log at least {MIN_QUALIFYING_ROUNDS} rounds ({rounds.length}/
            {MIN_QUALIFYING_ROUNDS} so far).
          </p>
        )}
        <p className="mt-1 text-xs text-neutral-500">
          {qualified ? "Based on your best 2 qualifying rounds." : "Average of your best 2 rounds once qualified."}
        </p>
        <Link href="/rounds" className="mt-3 inline-block text-sm text-green-700 underline">
          Log a round →
        </Link>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">Your team</h2>
        {myTeam ? (
          <p>
            You&apos;re paired with <span className="font-medium">{partnerName ?? "—"}</span>.
          </p>
        ) : (
          <p className="text-neutral-600">Teams haven&apos;t been generated yet.</p>
        )}
        {myTeam && (
          <Link href="/leaderboard" className="mt-3 inline-block text-sm text-green-700 underline">
            View leaderboard →
          </Link>
        )}
      </div>
    </div>
  );
}
