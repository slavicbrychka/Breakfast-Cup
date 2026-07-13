-- Buddy Cup Tournament Tracker — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

-- =========================================================================
-- profiles (one row per auth.users row; role drives permissions)
-- =========================================================================
create type user_role as enum ('admin', 'player');
create type season_status as enum ('qualifying', 'teams_set', 'in_progress', 'completed');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role user_role not null default 'player',
  created_at timestamptz not null default now()
);

-- New auth.users rows automatically get a profile. Everyone starts as
-- 'player' — promote the tournament organizer to 'admin' by hand afterward
-- (Supabase Studio > Table Editor > profiles, or see README).
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- security-definer helper so RLS policies can check role without recursive
-- lookups against the very table the policy protects
create function is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- =========================================================================
-- seasons
-- =========================================================================
create table seasons (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  qualification_start date,
  qualification_end date,
  status season_status not null default 'qualifying',
  created_at timestamptz not null default now()
);

-- =========================================================================
-- rounds (qualifying rounds, white tees)
-- =========================================================================
create table rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  season_id uuid not null references seasons (id) on delete cascade,
  course_par int not null check (course_par between 27 and 90),
  score int not null check (score > 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index rounds_season_user_idx on rounds (season_id, user_id);

-- =========================================================================
-- teams (2-player scramble teams for a season)
-- =========================================================================
create table teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons (id) on delete cascade,
  player_1_id uuid not null references profiles (id),
  player_2_id uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  constraint teams_distinct_players check (player_1_id <> player_2_id)
);

create index teams_season_idx on teams (season_id);

-- =========================================================================
-- tournament_scores (one row per team per round, blue tees, best ball)
-- =========================================================================
create table tournament_scores (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  season_id uuid not null references seasons (id) on delete cascade,
  round_number int not null check (round_number between 1 and 3),
  strokes int check (strokes > 0),
  entered_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, round_number)
);

create index tournament_scores_season_idx on tournament_scores (season_id);

create function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tournament_scores_set_updated_at
  before update on tournament_scores
  for each row execute procedure set_updated_at();

-- =========================================================================
-- trophy_history (perpetual trophy archive, one row per completed season)
-- =========================================================================
create table trophy_history (
  season_id uuid primary key references seasons (id) on delete cascade,
  winning_team_names text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table profiles enable row level security;
alter table seasons enable row level security;
alter table rounds enable row level security;
alter table teams enable row level security;
alter table tournament_scores enable row level security;
alter table trophy_history enable row level security;

-- profiles: everyone signed in can read the roster (names/handicaps are
-- shared context for the group); users edit their own name; only admins
-- can change roles or edit other people's rows.
create policy "profiles_select_all" on profiles
  for select to authenticated using (true);

create policy "profiles_update_own_name" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

create policy "profiles_admin_manage" on profiles
  for update to authenticated
  using (is_admin())
  with check (is_admin());

-- seasons: readable by everyone signed in; only admins create/modify.
create policy "seasons_select_all" on seasons
  for select to authenticated using (true);

create policy "seasons_admin_write" on seasons
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- rounds: everyone can read (read-only view of others' rounds); a player
-- can only insert/update/delete their own rounds, and only while the
-- season is still in the 'qualifying' status (admins bypass the lock).
create policy "rounds_select_all" on rounds
  for select to authenticated using (true);

create policy "rounds_insert_own" on rounds
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      is_admin()
      or exists (
        select 1 from seasons
        where seasons.id = season_id and seasons.status = 'qualifying'
      )
    )
  );

create policy "rounds_update_own" on rounds
  for update to authenticated
  using (
    is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from seasons
        where seasons.id = season_id and seasons.status = 'qualifying'
      )
    )
  )
  with check (user_id = auth.uid() or is_admin());

create policy "rounds_delete_own" on rounds
  for delete to authenticated
  using (
    is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from seasons
        where seasons.id = season_id and seasons.status = 'qualifying'
      )
    )
  );

-- teams: readable by everyone; only admins generate/edit/swap.
create policy "teams_select_all" on teams
  for select to authenticated using (true);

create policy "teams_admin_write" on teams
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- tournament_scores: readable by everyone (live leaderboard); a player can
-- enter/update scores only for a team they belong to, admins can do anything.
create policy "tournament_scores_select_all" on tournament_scores
  for select to authenticated using (true);

create policy "tournament_scores_insert_own_team" on tournament_scores
  for insert to authenticated
  with check (
    is_admin()
    or exists (
      select 1 from teams
      where teams.id = team_id
        and (teams.player_1_id = auth.uid() or teams.player_2_id = auth.uid())
    )
  );

create policy "tournament_scores_update_own_team" on tournament_scores
  for update to authenticated
  using (
    is_admin()
    or exists (
      select 1 from teams
      where teams.id = team_id
        and (teams.player_1_id = auth.uid() or teams.player_2_id = auth.uid())
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from teams
      where teams.id = team_id
        and (teams.player_1_id = auth.uid() or teams.player_2_id = auth.uid())
    )
  );

create policy "tournament_scores_admin_delete" on tournament_scores
  for delete to authenticated using (is_admin());

-- trophy_history: readable by everyone; only admins write (season completion).
create policy "trophy_history_select_all" on trophy_history
  for select to authenticated using (true);

create policy "trophy_history_admin_write" on trophy_history
  for all to authenticated
  using (is_admin())
  with check (is_admin());
