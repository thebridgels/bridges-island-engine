# Architecture

Bridges is a server-rendered Next.js (App Router) application on Supabase
(Postgres + Auth). All data access runs through the requesting user's
session against Row Level Security; there is no service-role access in the
app (see [the constitution](bridges-constitution.md), principle 1).

## Layers

| Layer | What it holds |
| ----- | ------------- |
| Identity | Supabase Auth (email + password); `profiles` mirrors `auth.users` for email→id lookup. |
| Structure | `islands` → `places` → `assets`; `architects` attach to an island or a place. Each island has a deterministic visual identity (`src/lib/island-identity.ts`). |
| Access | `bridges` grants + `private`/`bridged` visibility flags, enforced entirely by RLS policies in `supabase/migrations/`. |
| Trust | Append-only `audit_events` ledger + asset provenance fields ([provenance.md](provenance.md)). |
| Architects | Permissioned interfaces to island assets; knowledge is derived per request, never stored ([architect-knowledge.md](architect-knowledge.md)). No model is connected yet. |
| Ownership | Owner Export (`/islands/<id>/export`): an owner-only JSON snapshot of the island — places, assets with provenance, architects with knowledge summaries, bridge records, audit ledger. Built entirely through the owner's session (RLS enforced, no service-role access) and logged to the ledger as `export.island`. |

## Responsibility boundary

The platform must distinguish two kinds of responsibility, per
[constitution principle 2](bridges-constitution.md):

- **Owner responsibility — island contents and activity.** What exists on
  an island, what it represents, what it claims, who is granted access,
  and what visibility it carries are the owner's decisions and the owner's
  responsibility. The schema attributes all of it to the owner
  (`owner_id`, the audit ledger, provenance).
- **Platform responsibility — infrastructure, permissions, security, and
  enforcement.** Bridges is responsible for keeping the permission system
  correct (RLS), preserving identity on every action, protecting user
  access (auth, session handling), and honoring the constitutional
  boundaries of islands. The platform does not curate, own, or speak for
  island contents.

Features should be designed so this line stays legible: anything that
attributes content or activity should attribute it to the owner's
identity; anything that enforces boundaries should live in the database.
