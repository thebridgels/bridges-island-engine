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
