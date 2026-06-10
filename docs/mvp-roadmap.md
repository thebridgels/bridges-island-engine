# Bridges MVP Roadmap

Status as of 2026-06-10. Factual: nothing listed as implemented is partial
unless said so.

## 1. Implemented

All features below are built, linted, and building. Operational note: all
seven SQL migrations (including the stewards→architects rename) are applied
to a live Supabase project, `.env.local` holds real credentials, and the
full manual test plan passed end-to-end on 2026-06-10
([manual-test-plan.md](manual-test-plan.md)).

- **Auth** — Supabase email + password only (no OAuth, no magic links).
  Sign up, log in, log out; `src/proxy.ts` refreshes sessions and guards
  `/dashboard` and `/islands/*`; pages re-check the user server-side.
- **Islands** — owned rows (`owner_id → auth.users`), RLS-private unless
  bridged. Created and listed from the dashboard.
- **Places** — typed, positioned (0–100 × 0–100) points on an island with
  `private`/`bridged` visibility. Owner CRUD via server actions.
- **Assets** — content (document/image/link/note/file) attached to places:
  title, description, text content, URL. Visibility inherits island
  permissions and can only restrict further (bridged user needs island
  bridge + bridged place + bridged asset). Composite FK keeps
  `assets.island_id` consistent with the place's island.
- **Bridges** — owner grants access by email (resolved to a user id through
  a locked-down `profiles` table + security-definer lookup; no email
  enumeration), lists active bridges, revokes them. Bridges store user ids,
  never raw emails.
- **Architects** — the persistent AI presence that helps an owner design,
  build, organize, govern, protect, and present an island or place
  (8 initial roles), island-wide or place-scoped, with
  stored-but-unconnected `model_provider`/`model_name`. Not the owner, no
  authority above the owner, operates only within owner-granted,
  island-enforced permissions. Owner CRUD; bridged users see only bridged
  architects on visible scopes.
- **Architect Knowledge** — defined and implemented as derived scope, not
  storage: `architectKnowledge()` = architect scope ∩ viewer RLS visibility
  over existing places/assets. No knowledge table. Surfaced on architect
  cards. ([architect-knowledge.md](architect-knowledge.md))
- **Audit and Provenance** — append-only `audit_events` ledger (owner-read
  only, actor-verified inserts, no update/delete policies) logging all 11
  major owner actions; owner-only Ledger page. Assets carry `source_type`,
  `created_by_ai`, `source_note`. ([provenance.md](provenance.md))
- **Island Experience Layer** — each island has a deterministic silhouette
  and palette derived from its id; the island page is a full-bleed map
  where place markers are navigation; the dashboard is "the sea"; admin
  forms fold away. Server-rendered, no client JS beyond CSS animation.
- **Constitution and Architecture docs** — two adopted principles (No
  God-Mode Access; Island Ownership and Responsibility) in
  [bridges-constitution.md](bridges-constitution.md);
  [architecture.md](architecture.md) records the layers and the
  owner/platform responsibility boundary.

## 2. Immediate Next Steps (recommended, not yet implemented)

1. **Go live against a real Supabase project.** ✅ Done 2026-06-10: project
   created, migrations applied, `.env.local` filled, and the full checklist
   in [manual-test-plan.md](manual-test-plan.md) passed (three accounts:
   owner, bridged visitor, stranger — including a forged-write probe
   rejected by RLS).
2. **Connect architects to a real model (Claude first).** Server-side
   conversation route where prompt context is assembled exclusively from
   `architectKnowledge()` for the requesting session, architect replies are
   marked as AI, and architect activity is logged to the ledger with architect
   context in metadata. This is the product's center of gravity.
3. **Click-to-place on the island map.** The one deferred client
   component: choose a place's position by clicking the coastline instead
   of typing coordinates. Small, high-leverage for the ownership feeling.
4. **File uploads for assets via Supabase Storage.** The `file`/`image`
   asset types currently hold only URLs. Needs bucket policies that mirror
   the existing RLS layering — same two-gate visibility, no public buckets
   by default.
5. **Owner export.** A "take your island with you" JSON export (island,
   places, assets, architects, ledger). Cheap to build now, and it makes
   principle 2's ownership claim concrete.

## 3. Risks / Design Questions

- **Public views.** Everything today is private-or-bridged; there is no
  anonymous access of any kind. Should an island ever have a public shore
  (read-only, no account)? That would add an `anon` dimension to every RLS
  policy and to architect visibility — much cheaper to decide before the
  model connection than after.
- **File uploads / storage.** Storage policies are a second permission
  system that must not drift from the database's. Open questions: size
  limits, content scanning, whether bridged visitors may download
  originals or only view.
- **Real AI model connection.** Who pays for tokens (platform vs owner's
  own API key)? Are architect conversations stored — and if so, they become
  island content with visibility and provenance of their own. Rate
  limiting per visitor. Prompt-injection: bridged-visible assets become
  model input, so a visitor-facing architect reads owner-authored content as
  context — the trust direction needs thought.
- **Architect authority limits.** Architects are currently read-only lenses.
  May an architect ever write (create assets, summaries, notes)? If so:
  written *as whom*, marked how (`created_by_ai`/provenance), logged how,
  and capped by what? "Unless restricted later" in the knowledge rules
  also still needs its restriction mechanism.
- **Owner export / delete.** Export doesn't exist. Account deletion
  currently means cascading rows away (`on delete cascade`) with no
  off-boarding path; the ledger also dies with the island. Decide what
  "leaving with your island" and "destroying your island" each mean.
- **Encryption / security hardening.** Content is plaintext in Postgres
  (standard for this stage; Supabase encrypts at rest). No rate limiting
  on auth or actions, no CAPTCHA on signup, no session-revocation UI, and
  the bridge-grant flow confirms whether an email has an account
  (deliberate trade-off, worth revisiting). Audit logging is app-level,
  not trigger-level — a future code path could forget to log; triggers
  would close that gap at the cost of metadata control.
- **Legal terms.** Deliberately deferred. The constitution documents the
  responsibility model; terms of service and liability language come
  later, and nothing in the current docs should be read as legal
  protection.
