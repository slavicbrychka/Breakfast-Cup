"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-profile";

export async function submitScore(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not signed in");

  const teamId = String(formData.get("team_id") ?? "");
  const seasonId = String(formData.get("season_id") ?? "");
  const roundNumber = Number(formData.get("round_number"));
  const strokes = Number(formData.get("strokes"));

  if (!teamId || !seasonId || !roundNumber || !strokes) {
    throw new Error("Missing required fields");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_scores")
    .upsert(
      {
        team_id: teamId,
        season_id: seasonId,
        round_number: roundNumber,
        strokes,
        entered_by: profile.id,
      },
      { onConflict: "team_id,round_number" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/leaderboard");
}
