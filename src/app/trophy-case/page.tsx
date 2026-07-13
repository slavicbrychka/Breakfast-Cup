import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export default async function TrophyCasePage() {
  const supabase = await createClient();

  const { data: history } = await supabase
    .from("trophy_history")
    .select("*, season:seasons(year)")
    .order("season_id", { ascending: false });

  const entries = (history ?? []) as unknown as Array<{
    season_id: string;
    winning_team_names: string;
    photo_url: string | null;
    season: { year: number } | null;
  }>;

  entries.sort((a, b) => (b.season?.year ?? 0) - (a.season?.year ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Trophy Case</h1>

      {entries.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          No seasons have been completed yet — the trophy is still up for grabs.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <div
              key={entry.season_id}
              className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              {entry.photo_url && (
                <Image
                  src={entry.photo_url}
                  alt={`${entry.winning_team_names} trophy photo`}
                  width={80}
                  height={80}
                  unoptimized
                  className="h-20 w-20 rounded-md object-cover"
                />
              )}
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{entry.season?.year ?? "—"}</p>
                <p className="text-lg font-semibold">{entry.winning_team_names}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
