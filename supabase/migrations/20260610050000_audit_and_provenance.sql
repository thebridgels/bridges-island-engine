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
    'steward.created', 'steward.updated', 'steward.deleted',
    'bridge.granted', 'bridge.revoked'
  )),
  target_type text not null check (target_type in ('place', 'asset', 'steward', 'bridge')),
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
