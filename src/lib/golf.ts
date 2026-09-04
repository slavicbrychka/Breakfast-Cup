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

export interface HandicapDisplay {
  value: number;
  /** True when based on fewer than MIN_QUALIFYING_ROUNDS rounds — not yet official. */
  provisional: boolean;
}

/**
 * Handicap for display purposes: shows a provisional value from a single
 * round (rather than nothing) so standings are readable before a player
 * has qualified. Team pairing must still use calcHandicap, which requires
 * the full minimum round count.
 */
export function calcDisplayHandicap(
  rounds: Pick<Round, "score" | "course_par">[]
): HandicapDisplay | null {
  if (rounds.length === 0) return null;

  const official = calcHandicap(rounds);
  if (official != null) return { value: official, provisional: false };

  const differentials = rounds.map(roundDifferential);
  const avg = differentials.reduce((total, d) => total + d, 0) / differentials.length;
  return { value: avg, provisional: true };
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

/**
 * Rough 2-player scramble reduction applied to a team's combined handicap
 * to estimate their strokes-over-par pace. Common club-scramble rule of
 * thumb, not a rigorous statistical model — this whole prediction feature
 * is a for-fun admin tool, not a real forecast.
 */
export const SCRAMBLE_FACTOR = 0.25;

/** Stroke-gap constant controlling how quickly win odds fall off between teams. */
export const ODDS_SPREAD = 5;

export interface SimulatedTeam {
  players: [PlayerWithHandicap, PlayerWithHandicap];
  combinedHandicap: number;
  /** Predicted total strokes vs. par across TOURNAMENT_ROUNDS rounds (54 holes). */
  predictedDifferential: number;
}

/**
 * Pairs players the same way real team generation does (lowest handicap
 * with highest) and estimates each resulting team's scramble pace. Used
 * for the admin "what-if" simulator — doesn't touch the real teams table.
 */
export function simulateTeams(players: PlayerWithHandicap[]): SimulatedTeam[] {
  return generateTeamPairings(players).map(([a, b]) => {
    const combinedHandicap = a.handicap + b.handicap;
    return {
      players: [a, b],
      combinedHandicap,
      predictedDifferential: combinedHandicap * SCRAMBLE_FACTOR * TOURNAMENT_ROUNDS,
    };
  });
}

export interface TeamOdds {
  winProbability: number;
  /** American odds format, e.g. "-150" (favorite) or "+220" (underdog). */
  americanOdds: string;
}

/**
 * Converts predicted scores into illustrative win odds: the team predicted
 * to shoot the lowest score is the favorite, with likelihood falling off
 * as the stroke gap to the leader grows. A rough-and-ready heuristic for
 * admin fun, not a calibrated betting line.
 */
export function calcWinOdds(teams: SimulatedTeam[]): TeamOdds[] {
  if (teams.length === 0) return [];

  const best = Math.min(...teams.map((t) => t.predictedDifferential));
  const weights = teams.map((t) => Math.exp(-(t.predictedDifferential - best) / ODDS_SPREAD));
  const total = weights.reduce((sum, w) => sum + w, 0);

  return weights.map((w) => {
    const p = Math.min(0.99, Math.max(0.01, w / total));
    const americanOdds =
      p >= 0.5 ? `-${Math.round((p / (1 - p)) * 100)}` : `+${Math.round(((1 - p) / p) * 100)}`;
    return { winProbability: p, americanOdds };
  });
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
