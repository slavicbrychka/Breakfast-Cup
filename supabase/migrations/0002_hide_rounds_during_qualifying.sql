-- Hide other players' qualifying rounds/handicaps until qualifying closes.
-- Prevents sandbagging (playing worse on purpose to manipulate who you get
-- paired with) by making it impossible to see anyone else's rounds while
-- season.status = 'qualifying'. Own rounds stay visible always; admins can
-- always see everything.

drop policy "rounds_select_all" on rounds;

create policy "rounds_select" on rounds
  for select to authenticated
  using (
    is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from seasons
      where seasons.id = season_id and seasons.status <> 'qualifying'
    )
  );
