-- Places: points of interest on an island's map.
--
-- Visibility model:
--   * 'private'  - only the island owner can see the place.
--   * 'bridged'  - users with a bridge to the island can also read it.
-- Only the island owner can ever create, update, or delete places.

create table public.places (
  id uuid primary key default gen_random_uuid(),
  island_id uuid not null references public.islands (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  type text not null default 'landmark'
    check (type in ('home', 'workshop', 'garden', 'market', 'harbor', 'landmark', 'other')),
  description text check (description is null or char_length(description) <= 1000),
  position_x integer not null default 50 check (position_x between 0 and 100),
  position_y integer not null default 50 check (position_y between 0 and 100),
  visibility text not null default 'private' check (visibility in ('private', 'bridged')),
  created_at timestamptz not null default now()
);

create index places_island_id_idx on public.places (island_id);

alter table public.places enable row level security;

-- Reuses the security definer helpers from the islands/bridges migration.

create policy "Owners and allowed bridged users can view places"
on public.places for select
to authenticated
using (
  public.is_island_owner(island_id)
  or (visibility = 'bridged' and public.has_bridge_access(island_id))
);

create policy "Island owners can create places"
on public.places for insert
to authenticated
with check (public.is_island_owner(island_id));

create policy "Island owners can update places"
on public.places for update
to authenticated
using (public.is_island_owner(island_id))
with check (public.is_island_owner(island_id));

create policy "Island owners can delete places"
on public.places for delete
to authenticated
using (public.is_island_owner(island_id));
