import type { Database } from "@/lib/supabase/types";

type Round = Database["public"]["Tables"]["rounds"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Team = Database["public"]["Tables"]["teams"]["Row"];
type TournamentScore = Database["public"]["Tables"]["tournament_scores"]["Row"];

export const MIN_QUALIFYING_ROUNDS = 2;
export const BEST_ROUNDS_COUNTED = 2;
export const TOURNAMENT_ROUNDS = 3;

/** Score-to-par differential for a single round (lower is better). */
export function roundDifferential(round: Pick<Round, "score" | "course_par">): number {
  return round.score - round.course_par;
}

/**
 * Handicap = average of a player's best 2 qualifying-round differentials.
 * Returns null if the player hasn't logged the minimum number of rounds yet.
 */
export function calcHandicap(rounds: Pick<Round, "score" | "course_par">[]): number | null {
  if (rounds.length < MIN_QUALIFYING_ROUNDS) return null;

  const differentials = rounds.map(roundDifferential).sort((a, b) => a - b);
  const best = differentials.slice(0, BEST_ROUNDS_COUNTED);
  const sum = best.reduce((total, d) => total + d, 0);

  return sum / best.length;
}

export function isQualified(rounds: unknown[]): boolean {
  return rounds.length >= MIN_QUALIFYING_ROUNDS;
}

export interface PlayerWithHandicap {
  profile: Profile;
  handicap: number;
}

/**
 * Pairs lowest handicap with highest, second-lowest with second-highest,
 * etc. ("snake" pairing). Only players with a computed handicap are eligible.
 */
export function generateTeamPairings(
  players: PlayerWithHandicap[]
): [PlayerWithHandicap, PlayerWithHandicap][] {
  const sorted = [...players].sort((a, b) => a.handicap - b.handicap);
  const pairs: [PlayerWithHandicap, PlayerWithHandicap][] = [];

  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    pairs.push([sorted[lo], sorted[hi]]);
    lo += 1;
    hi -= 1;
  }

  // Odd player out (no partner left) is left unpaired — caller decides
  // how to handle (e.g. surface a warning to the admin).
  return pairs;
}

export interface LeaderboardRow<T extends Team = Team> {
  team: T;
  totalStrokes: number;
  roundsEntered: number;
  scoresByRound: Record<number, number | null>;
  isTiedForLead: boolean;
}

/**
 * Builds the leaderboard: total strokes across entered rounds per team,
 * sorted lowest-first. Teams that haven't finished all 3 rounds are still
 * shown (ranked by strokes-so-far) so the board can update live.
 * `isTiedForLead` flags teams tied for first *once all rounds are complete*,
 * which is when the 9-hole playoff rule applies.
 */
export function buildLeaderboard<T extends Team>(
  teams: T[],
  scores: TournamentScore[]
): LeaderboardRow<T>[] {
  const scoresByTeam = new Map<string, TournamentScore[]>();
  for (const score of scores) {
    const list = scoresByTeam.get(score.team_id) ?? [];
    list.push(score);
    scoresByTeam.set(score.team_id, list);
  }

  const rows: LeaderboardRow<T>[] = teams.map((team) => {
    const teamScores = scoresByTeam.get(team.id) ?? [];
    const scoresByRound: Record<number, number | null> = { 1: null, 2: null, 3: null };
    let totalStrokes = 0;
    let roundsEntered = 0;

    for (const s of teamScores) {
      scoresByRound[s.round_number] = s.strokes;
      if (s.strokes != null) {
        totalStrokes += s.strokes;
        roundsEntered += 1;
      }
    }

    return { team, totalStrokes, roundsEntered, scoresByRound, isTiedForLead: false };
  });

  rows.sort((a, b) => {
    if (a.roundsEntered !== b.roundsEntered) return b.roundsEntered - a.roundsEntered;
    return a.totalStrokes - b.totalStrokes;
  });

  const allComplete = rows.every((r) => r.roundsEntered === TOURNAMENT_ROUNDS);
  if (allComplete && rows.length > 0) {
    const leadScore = rows[0].totalStrokes;
    for (const row of rows) {
      if (row.totalStrokes === leadScore) row.isTiedForLead = true;
    }
  }

  return rows;
}
