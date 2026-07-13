# Buddy Cup Tournament Tracker

Web app for tracking handicap-qualification rounds, generating scramble teams,
and running the 54-hole Buddy Cup leaderboard — with real accounts and per-role
permissions (admin vs. player) via Supabase auth + row-level security.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind) — `src/app`
- **Supabase** — Postgres + auth + RLS, via `@supabase/ssr`
- **Vercel** — hosting (free tier is plenty for a private group)

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (free tier).
2. In **Project Settings → API**, copy the **Project URL** and **anon public key**.
3. Copy `.env.local.example` to `.env.local` and fill in those two values:

   ```bash
   cp .env.local.example .env.local
   ```

4. In **Project Settings → Authentication → Email**, make sure "Confirm email"
   matches what you want (it's fine to leave confirmation on or turn it off
   for a small private group — turning it off means guys can sign up and log
   in immediately without checking their inbox).

## 2. Run the database migration

1. Open the Supabase **SQL Editor** for your project.
2. Paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   and run it. This creates all tables (`profiles`, `seasons`, `rounds`,
   `teams`, `tournament_scores`, `trophy_history`), the trigger that
   auto-creates a `profiles` row on signup, and all row-level security
   policies.

   Everyone who signs up starts with the `player` role.

## 3. Promote yourself to admin

Since there's no admin yet, bootstrap the first one by hand:

1. Sign up for an account in the running app (see below).
2. In Supabase Studio, go to **Table Editor → profiles**, find your row, and
   change `role` from `player` to `admin`.
3. Reload the app — the **Admin** tab appears in the nav. From there you can
   promote/demote other players without touching the database directly.

## 4. Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on `/login`
until you sign up.

## 5. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new).
3. Add the same two environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. Deploy. Free tier is plenty for a group of 8–12 golfers.

## How the app matches the rules

- **Handicap** = average of a player's best 2 qualifying-round differentials
  (`score - course_par`), computed live as rounds are added — see
  [`src/lib/golf.ts`](src/lib/golf.ts).
- **Teams**: admin-only "Generate teams" sorts qualified players by handicap
  and pairs lowest with highest ("snake" pairing), with manual swap/override
  afterward in the admin panel.
- **Tournament**: 3 rounds / 54 holes, one combined strokes total per team
  per round, entered by either player on that team (or the admin). Leaderboard
  sorts by lowest total and flags ties for the 9-hole playoff once all 3
  rounds are in for every team.
- **Seasons**: qualifying rounds, teams, and tournament scores are all scoped
  to a `season_id`, so past years stay archived (`trophy_history`) instead of
  being overwritten when a new season starts.

## Permissions (row-level security)

- **Everyone signed in** can read the roster, rounds, teams, scores, and
  trophy history (read-only visibility into everyone else's data).
- **Players** can only insert/edit/delete their *own* qualifying rounds
  (while the season is in `qualifying` status), and only enter tournament
  scores for a team they belong to.
- **Admin** can create/edit seasons, lock/unlock qualifying, generate and
  override teams, edit any player's role, and archive the season's trophy
  winner.

This is enforced at the database level (not just hidden in the UI), so a
player can't bypass it by calling the API directly.
