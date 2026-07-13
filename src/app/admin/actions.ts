"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcHandicap, generateTeamPairings, type PlayerWithHandicap } from "@/lib/golf";
import type { SeasonStatus, UserRole } from "@/lib/supabase/types";

export async function createSeason(formData: FormData) {
  const year = Number(formData.get("year"));
  const qualificationStart = String(formData.get("qualification_start") ?? "") || null;
  const qualificationEnd = String(formData.get("qualification_end") ?? "") || null;

  if (!year) throw new Error("Year is required");

  const supabase = await createClient();
  const { error } = await supabase.from("seasons").insert({
    year,
    qualification_start: qualificationStart,
    qualification_end: qualificationEnd,
    status: "qualifying",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function setSeasonStatus(formData: FormData) {
  const seasonId = String(formData.get("season_id") ?? "");
  const status = String(formData.get("status") ?? "") as SeasonStatus;
  if (!seasonId || !status) throw new Error("Missing season or status");

  const supabase = await createClient();
  const { error } = await supabase.from("seasons").update({ status }).eq("id", seasonId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/rounds");
  revalidatePath("/leaderboard");
}

export async function updatePlayerRole(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  if (!userId || !role) throw new Error("Missing player or role");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function generateTeams(formData: FormData) {
  const seasonId = String(formData.get("season_id") ?? "");
  if (!seasonId) throw new Error("Missing season");

  const supabase = await createClient();

  const [{ data: profiles }, { data: rounds }] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("rounds").select("*").eq("season_id", seasonId),
  ]);

  const players: PlayerWithHandicap[] = (profiles ?? [])
    .map((profile) => {
      const playerRounds = (rounds ?? []).filter((r) => r.user_id === profile.id);
      const handicap = calcHandicap(playerRounds);
      return handicap != null ? { profile, handicap } : null;
    })
    .filter((p): p is PlayerWithHandicap => p !== null);

  const pairs = generateTeamPairings(players);

  await supabase.from("teams").delete().eq("season_id", seasonId);

  if (pairs.length > 0) {
    const { error } = await supabase.from("teams").insert(
      pairs.map(([a, b]) => ({
        season_id: seasonId,
        player_1_id: a.profile.id,
        player_2_id: b.profile.id,
      }))
    );
    if (error) throw new Error(error.message);
  }

  await supabase.from("seasons").update({ status: "teams_set" }).eq("id", seasonId);

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
}

export async function updateTeamPlayer(formData: FormData) {
  const teamId = String(formData.get("team_id") ?? "");
  const slot = String(formData.get("slot") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  if (!teamId || !playerId || (slot !== "player_1_id" && slot !== "player_2_id")) {
    throw new Error("Invalid team edit");
  }

  const supabase = await createClient();
  const update = slot === "player_1_id" ? { player_1_id: playerId } : { player_2_id: playerId };
  const { error } = await supabase.from("teams").update(update).eq("id", teamId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
}

export async function completeSeason(formData: FormData) {
  const seasonId = String(formData.get("season_id") ?? "");
  const winningTeamNames = String(formData.get("winning_team_names") ?? "").trim();
  const photoUrl = String(formData.get("photo_url") ?? "").trim() || null;

  if (!seasonId || !winningTeamNames) throw new Error("Missing season or winning team");

  const supabase = await createClient();

  const { error: trophyError } = await supabase.from("trophy_history").upsert({
    season_id: seasonId,
    winning_team_names: winningTeamNames,
    photo_url: photoUrl,
  });
  if (trophyError) throw new Error(trophyError.message);

  const { error: seasonError } = await supabase
    .from("seasons")
    .update({ status: "completed" })
    .eq("id", seasonId);
  if (seasonError) throw new Error(seasonError.message);

  revalidatePath("/admin");
  revalidatePath("/trophy-case");
  revalidatePath("/dashboard");
}
