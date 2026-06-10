-- Assets: content attached to a place on an island.
--
-- Visibility model (inherits island permissions, can only restrict further):
--   * Owners see and manage everything on their islands.
--   * A bridged user can read an asset only when ALL of:
--       - they hold a bridge to the island,
--       - the place is visibility = 'bridged',
--       - the asset is visibility = 'bridged'.
--     An asset can never be more visible than the place it sits on.

-- Composite key so assets.island_id can never contradict the place's island.
alter table public.places
  add constraint places_id_island_id_key unique (id, island_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  island_id uuid not null references public.islands (id) on delete cascade,
  place_id uuid not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  asset_type text not null default 'note'
    check (asset_type in ('document', 'image', 'link', 'note', 'file')),
  content_text text check (content_text is null or char_length(content_text) <= 20000),
  url text check (url is null or char_length(url) <= 2048),
  visibility text not null default 'private' check (visibility in ('private', 'bridged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (place_id, island_id)
    references public.places (id, island_id) on delete cascade
);

create index assets_island_id_idx on public.assets (island_id);
create index assets_place_id_idx on public.assets (place_id);

-- Keep updated_at accurate on every edit.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.assets enable row level security;

create policy "Owners and allowed bridged users can view assets"
on public.assets for select
to authenticated
using (
  public.is_island_owner(island_id)
  or (
    visibility = 'bridged'
    and public.has_bridge_access(island_id)
    and exists (
      select 1
      from public.places p
      where p.id = place_id
        and p.visibility = 'bridged'
    )
  )
);

create policy "Island owners can create assets"
on public.assets for insert
to authenticated
with check (
  public.is_island_owner(island_id)
  and owner_id = (select auth.uid())
);

create policy "Island owners can update assets"
on public.assets for update
to authenticated
using (public.is_island_owner(island_id))
with check (public.is_island_owner(island_id));

create policy "Island owners can delete assets"
on public.assets for delete
to authenticated
using (public.is_island_owner(island_id));
