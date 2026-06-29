-- Asset Presence ⟂ Asset Contents (Phase 1: local file references).
--
-- Bridges is a spatial space; an Asset is a *presence* in a Place, not merely
-- an attachment. This migration encodes the separation:
--
--   * Asset Presence  -> the existing `assets` row. It is the thing that
--     exists in a Place (and may later gain a spatial representation:
--     position, display object, locked container, etc.). Its visibility is
--     governed by the existing two-gate asset RLS. A new non-sensitive
--     column, `contents_kind`, lets a viewer *perceive* that contents exist
--     and their category, without revealing anything identifying.
--
--   * Asset Contents  -> the new `asset_files` row. It records WHERE the
--     bytes live and their identifying metadata (file name, size, MIME,
--     checksum, a human-only path note). In Phase 1 the only kind is
--     'local_reference': the file stays on the owner's own device. NO BYTES
--     are stored here or anywhere in Bridges, and there is no storage bucket.
--
-- Governing principle: "Perceiving that an Asset exists is not the same as
-- accessing its contents." Visibility (of the presence) and access (to the
-- contents) are two different gates on two different tables. In Phase 1
-- `asset_files` is OWNER-ONLY: bridged visitors may perceive the presence
-- but can read no file metadata or contents.
--
-- This migration adds no client UI and grants no Architect access; the
-- Architect context reads `assets`/`places` only and never `asset_files`.

-- ---------------------------------------------------------------------------
-- Asset Presence: perceivable contents category
-- ---------------------------------------------------------------------------

alter table public.assets
  add column contents_kind text not null default 'none'
    check (contents_kind in ('none', 'inline', 'link', 'local_reference'));

-- Composite key so an asset_files row's island can never contradict its
-- asset's island (same pattern places established for assets).
alter table public.assets
  add constraint assets_id_island_id_key unique (id, island_id);

-- ---------------------------------------------------------------------------
-- Asset Contents: file locator + metadata (no bytes)
-- ---------------------------------------------------------------------------

create table public.asset_files (
  id uuid primary key default gen_random_uuid(),
  -- One file per asset in Phase 1 (1:1). The composite FK pins the island.
  asset_id uuid not null unique,
  island_id uuid not null,
  registered_by uuid not null references auth.users (id) on delete cascade,
  storage_kind text not null default 'local_reference'
    check (storage_kind in ('local_reference')),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_size bigint check (file_size is null or file_size >= 0),
  mime_type text check (mime_type is null or char_length(mime_type) <= 255),
  -- 64 lowercase hex chars when present; null when not computed (e.g. a very
  -- large file). Computed in the browser; the bytes never reach Bridges.
  checksum_sha256 text
    check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  checksum_algo text not null default 'sha-256',
  -- A human note to the owner only (e.g. "external drive, Projects folder").
  -- NOT machine-openable and NOT a promise the app can resolve it. Owner-only
  -- by RLS below; never exposed to bridged visitors.
  local_path_note text
    check (local_path_note is null or char_length(local_path_note) <= 1024),
  source_last_modified timestamptz,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (asset_id, island_id)
    references public.assets (id, island_id) on delete cascade
);

create index asset_files_island_id_idx on public.asset_files (island_id);

-- Keep updated_at accurate (reuses the function from the assets migration).
create trigger asset_files_set_updated_at
before update on public.asset_files
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — OWNER ONLY (Phase 1).
--
-- No bridged/visitor policy exists, so bridged users get zero rows from
-- asset_files. They perceive the Asset Presence via the existing `assets`
-- policies (title/description/type + contents_kind), and nothing here.
-- ---------------------------------------------------------------------------

alter table public.asset_files enable row level security;

create policy "Island owners can view asset files"
on public.asset_files for select
to authenticated
using (public.is_island_owner(island_id));

create policy "Island owners can register asset files"
on public.asset_files for insert
to authenticated
with check (
  public.is_island_owner(island_id)
  and registered_by = (select auth.uid())
);

create policy "Island owners can update asset files"
on public.asset_files for update
to authenticated
using (public.is_island_owner(island_id))
with check (public.is_island_owner(island_id));

create policy "Island owners can delete asset files"
on public.asset_files for delete
to authenticated
using (public.is_island_owner(island_id));

-- ---------------------------------------------------------------------------
-- Atomic registration: Presence + Contents in one transaction.
--
-- security INVOKER: runs as the calling user, so RLS on both tables applies
-- exactly as if the client inserted the rows itself — no privilege bypass.
-- If either insert is rejected (by RLS or a constraint), the whole call
-- rolls back, so no orphaned presence can be created.
-- ---------------------------------------------------------------------------

create or replace function public.register_local_asset(
  p_island_id uuid,
  p_place_id uuid,
  p_title text,
  p_description text,
  p_asset_type text,
  p_source_type text,
  p_source_note text,
  p_visibility text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text,
  p_checksum_sha256 text,
  p_local_path_note text,
  p_source_last_modified timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset_id uuid;
  v_uid uuid := (select auth.uid());
begin
  -- Asset Presence. The assets INSERT policy still applies (owner-only,
  -- owner_id = auth.uid()); this function does not bypass it.
  insert into public.assets (
    island_id, place_id, owner_id, title, description,
    asset_type, content_text, url, visibility,
    source_type, created_by_ai, source_note, contents_kind
  )
  values (
    p_island_id, p_place_id, v_uid, p_title, p_description,
    p_asset_type, null, null, coalesce(p_visibility, 'private'),
    p_source_type, false, p_source_note, 'local_reference'
  )
  returning id into v_asset_id;

  -- Asset Contents locator. The asset_files INSERT policy still applies
  -- (owner-only, registered_by = auth.uid()).
  insert into public.asset_files (
    asset_id, island_id, registered_by, storage_kind,
    file_name, file_size, mime_type, checksum_sha256,
    local_path_note, source_last_modified
  )
  values (
    v_asset_id, p_island_id, v_uid, 'local_reference',
    p_file_name, p_file_size, p_mime_type, p_checksum_sha256,
    p_local_path_note, p_source_last_modified
  );

  return v_asset_id;
end;
$$;

revoke execute on function public.register_local_asset(
  uuid, uuid, text, text, text, text, text, text,
  text, bigint, text, text, text, timestamptz
) from public, anon;

grant execute on function public.register_local_asset(
  uuid, uuid, text, text, text, text, text, text,
  text, bigint, text, text, text, timestamptz
) to authenticated;
