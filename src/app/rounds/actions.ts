"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-profile";

export async function addRound(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not signed in");

  const seasonId = String(formData.get("season_id") ?? "");
  const coursePar = Number(formData.get("course_par"));
  const score = Number(formData.get("score"));
  const date = String(formData.get("date") ?? "");

  if (!seasonId || !coursePar || !score || !date) {
    throw new Error("Missing required fields");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("rounds").insert({
    user_id: profile.id,
    season_id: seasonId,
    course_par: coursePar,
    score,
    date,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/rounds");
  revalidatePath("/dashboard");
}

export async function addRoundForPlayer(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Admin only");

  const userId = String(formData.get("user_id") ?? "");
  const seasonId = String(formData.get("season_id") ?? "");
  const coursePar = Number(formData.get("course_par"));
  const score = Number(formData.get("score"));
  const date = String(formData.get("date") ?? "");

  if (!userId || !seasonId || !coursePar || !score || !date) {
    throw new Error("Missing required fields");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("rounds").insert({
    user_id: userId,
    season_id: seasonId,
    course_par: coursePar,
    score,
    date,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/rounds");
  revalidatePath("/dashboard");
}

export async function updateRound(formData: FormData) {
  const roundId = String(formData.get("round_id") ?? "");
  const coursePar = Number(formData.get("course_par"));
  const score = Number(formData.get("score"));

  if (!roundId || !coursePar || !score) {
    throw new Error("Missing required fields");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rounds")
    .update({ course_par: coursePar, score })
    .eq("id", roundId);

  if (error) throw new Error(error.message);

  revalidatePath("/rounds");
  revalidatePath("/dashboard");
}

export async function deleteRound(formData: FormData) {
  const roundId = String(formData.get("round_id") ?? "");
  if (!roundId) return;

  const supabase = await createClient();
  const { error } = await supabase.from("rounds").delete().eq("id", roundId);
  if (error) throw new Error(error.message);

  revalidatePath("/rounds");
  revalidatePath("/dashboard");
}
