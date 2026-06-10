-- Stewards: named caretaker roles attached to an island, or to a specific
-- place on it (place_id null = island-wide steward).
--
-- This phase is data model + UI only: model_provider / model_name are stored
-- configuration and are NOT connected to any external model yet.
--
-- Visibility model (same layering as assets):
--   * Owners see and manage everything on their islands.
--   * A bridged user can see a steward only when ALL of:
--       - they hold a bridge to the island,
--       - the steward is visibility = 'bridged',
--       - the steward is island-wide OR its place is visibility = 'bridged'.

create table public.stewards (
  id uuid primary key default gen_random_uuid(),
  island_id uuid not null references public.islands (id) on delete cascade,
  place_id uuid,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  role text not null default 'librarian'
    check (role in (
      'librarian', 'archivist', 'curator', 'researcher',
      'builder', 'teacher', 'receptionist', 'guardian'
    )),
  description text check (description is null or char_length(description) <= 1000),
  model_provider text check (model_provider in ('anthropic', 'openai', 'other')),
  model_name text check (model_name is null or char_length(model_name) <= 120),
  visibility text not null default 'private' check (visibility in ('private', 'bridged')),
  created_at timestamptz not null default now(),
  -- When place-scoped, the place must belong to the same island.
  -- (Composite FK is skipped when place_id is null.)
  foreign key (place_id, island_id)
    references public.places (id, island_id) on delete cascade
);

create index stewards_island_id_idx on public.stewards (island_id);
create index stewards_place_id_idx on public.stewards (place_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.stewards enable row level security;

create policy "Owners and allowed bridged users can view stewards"
on public.stewards for select
to authenticated
using (
  public.is_island_owner(island_id)
  or (
    visibility = 'bridged'
    and public.has_bridge_access(island_id)
    and (
      place_id is null
      or exists (
        select 1
        from public.places p
        where p.id = place_id
          and p.visibility = 'bridged'
      )
    )
  )
);

create policy "Island owners can create stewards"
on public.stewards for insert
to authenticated
with check (
  public.is_island_owner(island_id)
  and owner_id = (select auth.uid())
);

create policy "Island owners can update stewards"
on public.stewards for update
to authenticated
using (public.is_island_owner(island_id))
with check (public.is_island_owner(island_id));

create policy "Island owners can delete stewards"
on public.stewards for delete
to authenticated
using (public.is_island_owner(island_id));
