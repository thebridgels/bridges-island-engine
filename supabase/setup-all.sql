-- Consolidated setup script: produces the FINAL schema state, equivalent to
-- running all migrations in order (including 20260610060000, which renamed
-- stewards to architects — folded in here, so a fresh install creates
-- public.architects directly and never needs the rename — and 20260610070000,
-- which added the 'export.island' audit action).

-- ============================================================
-- 20260610000000_islands_and_bridges.sql
-- ============================================================
-- Islands and Bridges schema with Row Level Security.
--
-- Model:
--   * Every island belongs to exactly one auth user (owner_id -> auth.users.id).
--   * Islands are private by default: only the owner can see or modify them.
--   * A "bridge" is an explicit access grant from an island owner to another
--     user, which makes that island visible (read-only) to the grantee.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.islands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.bridges (
  id uuid primary key default gen_random_uuid(),
  island_id uuid not null references public.islands (id) on delete cascade,
  granted_to uuid not null references auth.users (id) on delete cascade,
  granted_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (island_id, granted_to)
);

create index islands_owner_id_idx on public.islands (owner_id);
create index bridges_island_id_idx on public.bridges (island_id);
create index bridges_granted_to_idx on public.bridges (granted_to);

-- ---------------------------------------------------------------------------
-- RLS helper functions
--
-- security definer so policy checks bypass RLS on the table they inspect;
-- without this, islands policies querying bridges (and vice versa) would
-- recurse infinitely.
-- ---------------------------------------------------------------------------

create or replace function public.has_bridge_access(island uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bridges b
    where b.island_id = island
      and b.granted_to = (select auth.uid())
  );
$$;

create or replace function public.is_island_owner(island uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.islands i
    where i.id = island
      and i.owner_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.islands enable row level security;
alter table public.bridges enable row level security;

-- Islands ------------------------------------------------------------------

create policy "Owners and bridged users can view islands"
on public.islands for select
to authenticated
using (
  owner_id = (select auth.uid())
  or public.has_bridge_access(id)
);

create policy "Users can create islands they own"
on public.islands for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "Owners can update their islands"
on public.islands for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners can delete their islands"
on public.islands for delete
to authenticated
using (owner_id = (select auth.uid()));

-- Bridges ------------------------------------------------------------------

create policy "Owners and grantees can view bridges"
on public.bridges for select
to authenticated
using (
  granted_to = (select auth.uid())
  or public.is_island_owner(island_id)
);

create policy "Island owners can create bridges"
on public.bridges for insert
to authenticated
with check (
  granted_by = (select auth.uid())
  and public.is_island_owner(island_id)
);

create policy "Owners can revoke bridges, grantees can leave"
on public.bridges for delete
to authenticated
using (
  granted_to = (select auth.uid())
  or public.is_island_owner(island_id)
);


-- ============================================================
-- 20260610010000_places.sql
-- ============================================================
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


-- ============================================================
-- 20260610020000_profiles_and_bridge_grants.sql
-- ============================================================
-- Profiles + email-based bridge granting.
--
-- The auth schema is not queryable from the client API, so granting a bridge
-- by email needs a public mirror of (user id, email):
--   * public.profiles is kept in sync with auth.users by a trigger.
--   * Profiles are NOT broadly readable. A security definer function performs
--     exact-match email -> user id lookup, so one user cannot enumerate
--     other users' email addresses; island owners can additionally read the
--     profiles of users bridged to their islands (to label the bridges list).

-- ---------------------------------------------------------------------------
-- Profiles table, synced from auth.users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null then
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_change
after insert or update of email on auth.users
for each row execute function public.handle_auth_user_change();

-- Backfill users that signed up before this migration.
insert into public.profiles (id, email)
select id, email from auth.users
where email is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Email -> user id lookup (exact match only, no enumeration)
-- ---------------------------------------------------------------------------

create or replace function public.lookup_user_id_by_email(lookup_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where lower(p.email) = lower(trim(lookup_email))
  limit 1;
$$;

revoke execute on function public.lookup_user_id_by_email(text) from public, anon;
grant execute on function public.lookup_user_id_by_email(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

-- Owners see the profiles of users bridged to their islands, so the
-- bridges list can show emails instead of raw user ids.
create policy "Island owners can view bridged users' profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.bridges b
    where b.granted_to = profiles.id
      and public.is_island_owner(b.island_id)
  )
);

-- No insert/update/delete policies: profiles are only written by the
-- security definer trigger, never directly by clients.


-- ============================================================
-- 20260610030000_assets.sql
-- ============================================================
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


-- ============================================================
-- 20260610040000_stewards.sql + 20260610060000_rename_stewards_to_architects.sql
-- ============================================================
-- Architects: the persistent AI presence that helps an owner design, build,
-- organize, govern, protect, and present an Island or Place (place_id null =
-- island-wide architect). The Architect is not the owner, has no authority
-- above the owner, and operates only within the permissions granted by the
-- owner and enforced by the Island.
--
-- This phase is data model + UI only: model_provider / model_name are stored
-- configuration and are NOT connected to any external model yet.
--
-- Visibility model (same layering as assets):
--   * Owners see and manage everything on their islands.
--   * A bridged user can see an architect only when ALL of:
--       - they hold a bridge to the island,
--       - the architect is visibility = 'bridged',
--       - the architect is island-wide OR its place is visibility = 'bridged'.

create table public.architects (
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

create index architects_island_id_idx on public.architects (island_id);
create index architects_place_id_idx on public.architects (place_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.architects enable row level security;

create policy "Owners and allowed bridged users can view architects"
on public.architects for select
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

create policy "Island owners can create architects"
on public.architects for insert
to authenticated
with check (
  public.is_island_owner(island_id)
  and owner_id = (select auth.uid())
);

create policy "Island owners can update architects"
on public.architects for update
to authenticated
using (public.is_island_owner(island_id))
with check (public.is_island_owner(island_id));

create policy "Island owners can delete architects"
on public.architects for delete
to authenticated
using (public.is_island_owner(island_id));


-- ============================================================
-- 20260610050000_audit_and_provenance.sql
-- ============================================================
-- Trust layer: audit events + asset provenance.
--
-- audit_events is the island's ledger: who did what, to what, when.
--   * Only the island owner can read it. Bridged users get nothing.
--   * Rows can only be inserted by their own actor, never updated or
--     deleted through the API (no update/delete policies) - the log is
--     append-only from the client's point of view.
--   * metadata is minimal and non-sensitive: display names only, no
--     content, no emails.
--
-- Asset provenance answers "where did this come from": source_type,
-- created_by_ai, and a free-text source_note.

-- ---------------------------------------------------------------------------
-- Audit events
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  island_id uuid not null references public.islands (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in (
    'place.created', 'place.updated', 'place.deleted',
    'asset.created', 'asset.updated', 'asset.deleted',
    'architect.created', 'architect.updated', 'architect.deleted',
    'bridge.granted', 'bridge.revoked',
    'export.island'
  )),
  target_type text not null check (target_type in ('place', 'asset', 'architect', 'bridge', 'island')),
  target_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_island_created_idx
  on public.audit_events (island_id, created_at desc);

alter table public.audit_events enable row level security;

create policy "Island owners can view their audit events"
on public.audit_events for select
to authenticated
using (public.is_island_owner(island_id));

create policy "Island owners can record their own actions"
on public.audit_events for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and public.is_island_owner(island_id)
);

-- No update or delete policies: the ledger is append-only via the API.

-- ---------------------------------------------------------------------------
-- Asset provenance
-- ---------------------------------------------------------------------------

alter table public.assets
  add column source_type text not null default 'original'
    check (source_type in ('original', 'uploaded', 'ai_generated', 'imported', 'linked')),
  add column created_by_ai boolean not null default false,
  add column source_note text
    check (source_note is null or char_length(source_note) <= 500);


