# Bridges Island Engine

Next.js (App Router) + Supabase MVP. Users own private **islands**; a **bridge**
is an explicit grant that shares an island with another user. Auth is Supabase
email + password only (no OAuth, no magic links).

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Configure env vars.** Copy `.env.example` to `.env.local` and fill in the
   values from *Dashboard → Project Settings → API*:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```

3. **Apply the database migration.** Either paste
   [supabase/migrations/20260610000000_islands_and_bridges.sql](supabase/migrations/20260610000000_islands_and_bridges.sql)
   into the Supabase SQL Editor and run it, or use the CLI:

   ```
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. **(Recommended for dev) Disable email confirmation** so signup logs you in
   immediately: *Dashboard → Authentication → Sign In / Providers → Email →
   turn off "Confirm email"*. The app handles both modes — with confirmation
   on, signup redirects to login with a "check your email" notice.

5. **Run the app:**

   ```
   npm run dev
   ```

## Auth model

- Sign up / log in with email + password (`/signup`, `/login`); log out from
  the dashboard.
- [src/proxy.ts](src/proxy.ts) refreshes the Supabase session on every request
  and redirects unauthenticated users away from `/dashboard` and `/islands/*`.
  Pages also re-check the user server-side as defense in depth.
- Every island row has `owner_id → auth.users.id`.

## Places

Each island has a map of **places** (name, type, description, position, and
visibility), managed from the island detail page (`/islands/<id>`). Places are
rendered as markers on a simple percentage-positioned map plus cards below it.
A place's `visibility` is either `private` (owner only) or `bridged` (also
readable by users with a bridge to the island).

## Assets

Each place has **assets** (document, image, link, note, or file) with a title,
optional description, text content, and URL, managed from the place view
(`/islands/<id>/places/<placeId>`). Asset visibility inherits island
permissions but can only restrict further: a bridged user sees an asset only
when they hold a bridge to the island, the place is `bridged`, *and* the asset
is `bridged`. An asset can never be more visible than the place it sits on.

## Stewards

Each island can appoint **stewards** — named caretakers with a role
(Librarian, Archivist, Curator, Researcher, Builder, Teacher, Receptionist,
Guardian) — managed from `/islands/<id>/stewards`. A steward is either
island-wide or assigned to a specific place; place-scoped stewards also show
up on that place's page. Stewards store an optional `model_provider` /
`model_name` as configuration only — **no external model is connected yet**;
this phase is data model and interface. Visibility follows the same layering
as assets: bridged users see only `bridged` stewards that are island-wide or
on a `bridged` place.

Stewards do not own knowledge — they are permissioned interfaces to island
assets. A steward's knowledge is derived at read time from the places and
assets it may access (the whole island for island stewards, a single place
for place stewards), always through the viewer's RLS-filtered session. There
is no knowledge table. See [docs/steward-knowledge.md](docs/steward-knowledge.md).

## Bridges

Island owners manage bridges from the island detail page: grant access by
entering another user's email, see the list of active bridges, and revoke
them. Email → user id resolution goes through a `security definer` function
backed by a `profiles` table that a trigger keeps in sync with `auth.users`
(the `auth` schema itself is not client-queryable). Bridges always store the
grantee's user id, never the raw email. Profiles are not broadly readable —
users see their own profile, and owners see profiles of users bridged to
their islands.

## Constitution

Non-negotiable principles live in
[docs/bridges-constitution.md](docs/bridges-constitution.md) — starting with
**No God-Mode Access**: all access runs through the requesting identity's
permissions, and the Island's boundaries are enforced by the database, not
application promises.

## Trust layer

Every asset carries provenance — `source_type` (original, uploaded,
ai_generated, imported, linked), a `created_by_ai` flag, and an optional
`source_note` — shown wherever the asset is shown. Every major owner action
(places, assets, stewards, bridges) is recorded in an append-only
`audit_events` ledger, readable only by the island owner at
`/islands/<id>/audit`. Bridged users cannot read audit events. Metadata is
minimal and non-sensitive (display names only). See
[docs/provenance.md](docs/provenance.md).

## Row Level Security

Defined in the [islands/bridges](supabase/migrations/20260610000000_islands_and_bridges.sql),
[places](supabase/migrations/20260610010000_places.sql), and
[profiles](supabase/migrations/20260610020000_profiles_and_bridge_grants.sql) migrations:

- **islands** — owners have full access; other users can *read* an island only
  if a bridge grants them access. Inserts must set `owner_id` to the caller.
- **bridges** — only the island owner can create them; the owner can revoke
  and the grantee can remove their own access.
- **places** — only the island owner can create/update/delete; bridged users
  can read a place only when its `visibility` is `bridged`.
- **assets** — only the island owner can create/update/delete; bridged users
  can read an asset only when both the place and the asset are `bridged`. A
  composite foreign key guarantees `assets.island_id` always matches the
  place's island.
- **stewards** — only the island owner can create/update/delete; bridged
  users can read a steward only when it is `bridged` and either island-wide
  or on a `bridged` place. The same composite foreign key pattern keeps
  place-scoped stewards on the right island.
- **audit_events** — only the island owner can read; inserts must come from
  the owner acting as themselves; no update/delete policies, so the ledger
  is append-only through the API.
- Policies use `security definer` helper functions (`has_bridge_access`,
  `is_island_owner`) to avoid recursive RLS between tables.

All data access goes through the user's session (anon key + RLS); there is no
service-role key in the app.
