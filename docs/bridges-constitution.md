# The Bridges Constitution

Principles that govern how Bridges is built. Code, schema, and features may
change freely; these may not be violated by any of them. New principles are
added by the owner of this project, not inferred.

## 1. No God-Mode Access

*Adopted 2026-06-10 at the owner's explicit request.*

Normal access to an Island must occur through the identity and permissions
of the person or agent requesting access.

Bridges must not use unrestricted administrative access for ordinary
user-facing reads, writes, steward knowledge, bridge visibility, or model
context assembly.

Service-role or administrative access, if ever introduced, may only be used
for narrowly scoped maintenance tasks, never to bypass an Island owner's
permissions.

The Island's boundaries must be enforced by the database, not merely by
application promises.

### As enforced today

- Every Supabase client in the app uses the anon key plus the requesting
  user's session (`src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`,
  `src/proxy.ts`). No service-role key exists in the codebase or its
  environment files.
- All boundaries live in Row Level Security policies in
  [`supabase/migrations/`](../supabase/migrations/) — islands, places,
  assets, stewards, bridges, profiles, and the audit ledger are each
  protected at the database layer, so a bug in application code cannot
  widen access.
- Steward knowledge is derived through the viewer's session
  ([steward-knowledge.md](steward-knowledge.md)), and audit logging records
  the requesting user's identity through their own session
  ([provenance.md](provenance.md)). When model context assembly arrives, it
  inherits this rule: context is built exclusively from what the requesting
  identity may see.

## 2. Island Ownership and Responsibility

*Adopted 2026-06-10 at the owner's explicit request.*

Each Island is owned by its owner.

The owner controls the Island, determines its structure, governs access,
chooses what is private or visible, and decides which Bridges may connect
to it.

Because the Island belongs to the owner, the owner is responsible for the
materials, actions, representations, transactions, and permissions
originating from that Island.

Bridges does not claim ownership of an Island or its contents.

Bridges provides the infrastructure through which Islands may be created,
protected, connected, and visited.

Bridges is responsible for maintaining the integrity of the platform,
enforcing permission systems, protecting user access, and honoring the
constitutional boundaries of Islands.

Ownership creates authority.

Authority creates responsibility.

### As enforced today

- Ownership is structural, not declarative: `islands.owner_id`,
  `assets.owner_id`, and `stewards.owner_id` reference `auth.users`, and
  RLS `with check` policies require the creator to be the caller. There is
  no mechanism by which the platform, or any other user, becomes an owner
  of an Island's contents.
- The owner's control is exclusive at the database layer: only the owner
  can create, change, or remove places, assets, and stewards; only the
  owner can set `private`/`bridged` visibility; only the owner can grant a
  bridge ([provenance.md](provenance.md), the RLS policies in
  [`supabase/migrations/`](../supabase/migrations/)).
- The responsibility trail exists: every major owner action is recorded in
  the island's append-only audit ledger under the owner's own identity,
  and assets carry owner-declared provenance.
- The platform side of the bargain is principle 1: boundaries enforced by
  the database, no god-mode access, identity preserved on every action.

Not yet enforced (and intentionally not claimed): ownership transfer,
account-level governance, terms of service, and liability terms do not
exist yet. This principle documents the model; it is not a legal
instrument.
