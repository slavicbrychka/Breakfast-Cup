-- Let admins log a qualifying round on behalf of any player (e.g. someone
-- who doesn't use the app themselves). The previous insert policy required
-- user_id = auth.uid() unconditionally, which blocked this even for admins.

drop policy "rounds_insert_own" on rounds;

create policy "rounds_insert" on rounds
  for insert to authenticated
  with check (
    is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from seasons
        where seasons.id = season_id and seasons.status = 'qualifying'
      )
    )
  );
