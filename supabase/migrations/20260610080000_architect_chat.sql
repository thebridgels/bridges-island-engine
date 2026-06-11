-- Architect Chat (phase 1, owner-only): dedicated conversation tables.
--
-- Conversations are a third kind of thing on an island: not curated content
-- (assets), not governance history (audit_events) — interaction records.
-- See docs/architect-chat-plan.md for the full design.
--
--   * Owner-only by policy: a bridged visitor gets zero rows. Visitor chat
--     is a deliberate phase-2 decision; its policies are deliberately
--     absent here.
--   * Architect replies are written through the requesting owner's session
--     (no service-role access), marked AI at the schema level:
--     created_by_ai is CHECK-constrained to equal (role = 'architect').
--   * actor_id is the authenticated human session behind the row: for
--     'user' rows, the human who wrote the message; for 'architect' rows,
--     the human whose request caused the reply to be generated. The human
--     is not the *author* of an AI reply — hence actor, not author.
--   * Messages are append-only through the API: no update/delete policies.
--     Removing a conversation is the owner deleting the conversation row;
--     messages cascade at the FK level.

-- The composite FK below needs (id, island_id) addressable on architects,
-- same pattern places established for assets.
alter table public.architects
  add constraint architects_id_island_id_key unique (id, island_id);

create table public.architect_conversations (
  id uuid primary key default gen_random_uuid(),
  island_id uuid not null references public.islands (id) on delete cascade,
  architect_id uuid not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The architect must live on the same island.
  foreign key (architect_id, island_id)
    references public.architects (id, island_id) on delete cascade,
  unique (id, island_id)
);

create table public.architect_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  island_id uuid not null references public.islands (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'architect')),
  content text not null check (char_length(content) between 1 and 8000),
  created_by_ai boolean not null,
  model_provider text check (model_provider in ('anthropic', 'openai', 'other')),
  model_name text check (model_name is null or char_length(model_name) <= 120),
  created_at timestamptz not null default now(),
  -- The conversation must belong to the same island.
  foreign key (conversation_id, island_id)
    references public.architect_conversations (id, island_id) on delete cascade,
  -- Provenance for words, structural: AI-marking can never drift from role.
  check (created_by_ai = (role = 'architect')),
  -- Architect rows must record which model spoke.
  check (role = 'user' or (model_provider is not null and model_name is not null))
);

create index architect_conversations_island_idx
  on public.architect_conversations (island_id, architect_id);
create index architect_messages_conversation_idx
  on public.architect_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security — owner-only; visitor policies deliberately absent.
-- ---------------------------------------------------------------------------

alter table public.architect_conversations enable row level security;
alter table public.architect_messages enable row level security;

create policy "Island owners can view their conversations"
on public.architect_conversations for select
to authenticated
using (public.is_island_owner(island_id));

create policy "Island owners can start conversations"
on public.architect_conversations for insert
to authenticated
with check (
  public.is_island_owner(island_id)
  and owner_id = (select auth.uid())
);

create policy "Island owners can update their conversations"
on public.architect_conversations for update
to authenticated
using (public.is_island_owner(island_id))
with check (public.is_island_owner(island_id));

create policy "Island owners can delete their conversations"
on public.architect_conversations for delete
to authenticated
using (public.is_island_owner(island_id));

create policy "Island owners can view their conversation messages"
on public.architect_messages for select
to authenticated
using (public.is_island_owner(island_id));

create policy "Island owners can append conversation messages"
on public.architect_messages for insert
to authenticated
with check (
  public.is_island_owner(island_id)
  and actor_id = (select auth.uid())
);

-- No update or delete policies on messages: transcripts are append-only
-- through the API.

-- ---------------------------------------------------------------------------
-- Audit vocabulary: architect.replied (activity only, never content)
-- ---------------------------------------------------------------------------

alter table public.audit_events drop constraint audit_events_action_check;

alter table public.audit_events add constraint audit_events_action_check
  check (action in (
    'place.created', 'place.updated', 'place.deleted',
    'asset.created', 'asset.updated', 'asset.deleted',
    'architect.created', 'architect.updated', 'architect.deleted',
    'architect.replied',
    'bridge.granted', 'bridge.revoked',
    'export.island'
  ));
