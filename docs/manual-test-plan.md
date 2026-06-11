# Manual Test Plan — Supabase Live Verification

Purpose: prove RLS, ownership, bridges, visibility, and audit behavior in a
real Supabase project. No AI connection, no public views, no uploads.

Date run: 2026-06-10  Tester: Claude Code (automated browser walkthrough)
Sections 6b/6c run: 2026-06-11 (same tester; browser + REST probes)
Supabase project ref: wprjvtyzicxtngvxvpqm

## 0. Setup

- [x] Supabase project created (region of choice, free tier is fine)
- [x] **Email confirmation disabled** for this test run:
      Dashboard → Authentication → Sign In / Providers → Email →
      "Confirm email" OFF (otherwise signup detours through email)
- [x] All nine migrations applied **in this order** via SQL Editor
      (paste each file's contents and Run, one at a time — or run
      `setup-all.sql` once, which folds them all in):
  - [x] `20260610000000_islands_and_bridges.sql`
  - [x] `20260610010000_places.sql`
  - [x] `20260610020000_profiles_and_bridge_grants.sql`
  - [x] `20260610030000_assets.sql`
  - [x] `20260610040000_stewards.sql` (historical name; table is renamed below)
  - [x] `20260610050000_audit_and_provenance.sql`
  - [x] `20260610060000_rename_stewards_to_architects.sql`
  - [x] `20260610070000_export_audit_action.sql`
  - [x] `20260610080000_architect_chat.sql`
- [x] Table Editor shows: `islands`, `bridges`, `places`, `profiles`,
      `assets`, `architects`, `audit_events` — each with RLS marked enabled
- [x] `.env.local` filled with the project's URL and anon key
      (Dashboard → Project Settings → API)
- [x] `npm run dev` starts; http://localhost:3000 shows the landing page

## 1. Accounts

Use three accounts in three separate browser profiles/incognito windows so
sessions don't collide:

| Handle  | Email                          | Role |
| ------- | ------------------------------ | ---- |
| OWNER   | bridges.test.owner@gmail.com   | Owns the island |
| VISITOR | bridges.test.visitor@gmail.com | Will receive a bridge |
| STRANGER| bridges.test.stranger@gmail.com| Never bridged |

> Note: the original `@test.local` fixtures are rejected by Supabase's
> hosted email validation ("Email address is invalid" — `.local` is not a
> real TLD; `@example.com` is rejected too as a reserved domain). Gmail-format
> addresses pass validation; with "Confirm email" off no mail is ever sent.

- [x] OWNER signs up and lands on /dashboard ("Your waters")
- [x] VISITOR signs up successfully
- [x] STRANGER signs up successfully
- [x] Logging out returns to /login; hitting /dashboard logged-out
      redirects to /login

## 2. Owner builds the island

As OWNER — create this exact fixture (names matter for later checks):

- [x] Raise island **Saltwind** → island page shows silhouette map,
      "You are home."
- [x] Build place **Lighthouse** — visibility **bridged**
- [x] Build place **Vault** — visibility **private**
- [x] Both appear as markers on the map and as cards
- [x] On **Lighthouse**: add asset **Welcome Note** (note) — visibility
      **bridged**, source "made here"
- [x] On **Lighthouse**: add asset **Owner Diary** (note) — visibility
      **private**
- [x] On **Vault**: add asset **Secret Map** (note) — visibility
      **bridged** (deliberate: bridged asset on a private place)
- [x] Appoint architect **Harbormaster** — island-wide, visibility **bridged**
- [x] Appoint architect **Vaultkeeper** — assigned to Vault, visibility
      **bridged**
- [x] Appoint architect **Confidant** — island-wide, visibility **private**
- [x] Architect cards show knowledge ("Knows the island, 2 places · 3 assets"
      for island-wide architects)
- [x] Edit and delete round-trip: edit Lighthouse's description, create a
      throwaway place **Shed** and delete it

## 3. Bridge

As OWNER, island page → Bridges:

- [x] Granting to `nobody@test.local` fails with "No user found"
- [x] Granting to OWNER's own email fails with "You already own this island"
- [x] Granting to `visitor@test.local` succeeds; bridge listed with email
- [x] Granting again fails with "already has a bridge"

## 4. Visitor sees only the bridged island

As VISITOR:

- [x] /dashboard shows **Saltwind** under "Across the bridges"
- [x] Island page says "You've crossed a bridge…" — NOT "You are home."
- [x] Map shows **Lighthouse** only — **Vault is absent**
- [x] Architects page shows **Harbormaster** only — Confidant (private) and
      Vaultkeeper (bridged but on a private place) are absent
- [x] Harbormaster's knowledge shows only Lighthouse + **Welcome Note**
      (1 place · 1 asset) — not Owner Diary, not Vault, not Secret Map
- [x] Lighthouse page shows **Welcome Note** only — Owner Diary absent
- [x] **No owner controls anywhere**: no Build a place, no Bridges section,
      no edit/delete on places or assets, no architect forms, no Ledger link
- [x] Direct-URL probes (copy ids from OWNER's browser):
  - [x] Vault's place URL → 404
  - [x] /islands/<id>/audit → 404
- [x] Forged write probe (optional, proves RLS not UI): from VISITOR's
      browser devtools on the island page, POSTing the create-place form is
      blocked — or simpler, confirm no form exists to submit. RLS is the
      real gate; UI absence is the first line only.

## 5. Stranger gets nothing

As STRANGER:

- [x] /dashboard shows no islands ("Open water…")
- [x] Saltwind's island URL (copied from OWNER) → 404
- [x] Lighthouse's place URL → 404
- [x] /islands/<id>/audit → 404

## 6. Audit ledger

As OWNER, island page → 📜 Ledger:

- [x] Every action from section 2–3 is present, newest first: places
      built/edited/removed (Shed shows "removed a place: Shed"), assets
      added, architects appointed, bridge raised
- [x] Entries read "You …" with names, timestamps populated
- [x] Metadata is names only — no asset content, no emails visible
- [x] As VISITOR: the Ledger URL → 404 (checked in section 4)
- [x] SQL Editor spot-check (runs as postgres, bypasses RLS — expected):
      `select action, target_type, metadata from audit_events order by
      created_at;` rows match the UI

## 6b. Owner Export

As OWNER, island page → ⬇️ Export:

- [x] Export page loads at /islands/<id>/export; explains the export
      belongs to the owner, includes structure and content, excludes
      platform secrets, and is a snapshot
- [x] "Export Island" downloads a JSON file
      (Content-Disposition: `island-saltwind-2026-06-10.json`)
- [x] JSON contains: export_version, exported_at, island, places (2),
      assets (3, with source_type / created_by_ai / source_note),
      architects (3, each with knowledge_summary), bridges (with grantee
      email), audit_events, and the ownership/security notes
      *(run post-revoke, so `bridges: []` — structurally present but empty;
      the grantee-email field shape was not exercised with live data)*
- [x] Nothing secret in the file: no keys, no tokens, no session data
      (scanned for publishable/secret key prefixes, JWT prefix, apikey,
      access_token, ANTHROPIC — zero matches)
- [x] "exported the island" appears in the Ledger after download
      (metadata: `{"export_version": "1"}` only)

As VISITOR (verified post-revoke; the route is owner-only via the same
guard verified 404 for a *bridged* visitor on the chat route in 6c):

- [x] /islands/<id>/export → 404
- [x] /islands/<id>/export/download → 404

As STRANGER:

- [x] /islands/<id>/export → 404
- [x] /islands/<id>/export/download → 404

## 6c. Architect Chat (owner-only, phase 1)

Setup: `.env.local` has `ANTHROPIC_API_KEY` (and optionally
`ANTHROPIC_DEFAULT_MODEL`); dev server restarted after adding them.

As OWNER, architects page → 💬 Talk on **Harbormaster**:

- [x] Chat page loads at /islands/<id>/architects/<architectId>/chat with
      "What Harbormaster can see right now" matching the card's knowledge
      (the island, 2 places · 3 assets) — *verified in the no-key state:
      page renders, knowledge panel correct, "every reply is AI-generated"
      notice shown, graceful "Harbormaster cannot speak yet" with no
      message form when ANTHROPIC_API_KEY is absent*
- [x] Sending "What do you know about this island?" produces a reply
      visibly badged "Harbormaster · AI" *(run 2026-06-11 after adding
      ANTHROPIC_API_KEY locally; model: claude-haiku-4-5-20251001)*
- [x] The reply is grounded: mentions Saltwind content (e.g. Lighthouse or
      Welcome Note), no invented places — *reply described Lighthouse,
      Welcome Note ("The lamp is always lit"), Vault, and Secret Map; all
      real fixture content, correct for the owner who sees everything*
- [x] Reply persists across a page reload (stored, not ephemeral)
- [x] "conferred with an architect: Harbormaster" appears in the Ledger —
      and the ledger entry contains NO message content — *two
      `architect.replied` events, metadata exactly `{"name":"Harbormaster"}`*
- [x] SQL spot-check: `select role, created_by_ai, model_provider,
      model_name from architect_messages order by created_at;` —
      architect rows have created_by_ai = true and a recorded model —
      *user rows: false/null/null; architect rows: true/anthropic/
      claude-haiku-4-5-20251001*
- [x] Vault probe (RLS through the model): ask Harbormaster about "Secret
      Map" — as OWNER it may answer (owner sees everything) — *it answered
      with the map's content, correct for the owner; visitor paths
      confirmed closed below*
- [x] "Start a new conversation" gives an empty thread; the old one stays
      in the database — *2 conversations, 4 messages after the run*

As VISITOR (bridged — bridge re-granted through the app for this check,
then revoked again; both ends ledger-logged):

- [x] Architects page shows NO 💬 Talk link (page shows Harbormaster only,
      knowledge correctly narrowed to "1 place · 1 asset")
- [x] /islands/<id>/architects/<architectId>/chat → 404 (while bridged)
- [x] Forged read probe (proves RLS, not UI): direct REST selects on
      architect_conversations / architect_messages with VISITOR's real JWT
      returned zero rows — probed both unbridged AND bridged. Extra: forged
      REST *inserts* on both tables as VISITOR were rejected with HTTP 403
      `42501 new row violates row-level security policy`. Probe rows were
      created and removed through OWNER's session only. Re-probed
      2026-06-11 with real transcripts present (2 conversations,
      4 messages): OWNER reads all of them; VISITOR, STRANGER, and ANON
      all read zero rows; visitor forged write again rejected 403.

As STRANGER:

- [x] Chat URL → 404

## 7. Revoke and confirm closure

As OWNER: revoke VISITOR's bridge.

- [x] Bridge disappears from the owner's list; "withdrew a bridge" appears
      in the Ledger
- [x] As VISITOR: Saltwind gone from /dashboard; island URL now → 404

## Result

- [x] **ALL PASS** — RLS, ownership, bridges, visibility, and audit
      behavior verified against a live Supabase project
- Failures / notes:

  No failures. Deviations and extras from the 2026-06-10 run:

  1. Test emails changed from `@test.local` to `bridges.test.*@gmail.com`
     (see note in section 1) — Supabase rejects fake TLDs and reserved
     domains at signup.
  2. "Confirm email" had to be switched OFF mid-run; before that, signup
     failed with "email rate limit exceeded" and no users were created.
  3. Section 0 migration checkboxes: schema was applied previously via
     `setup-all.sql` (not re-run); all 7 tables verified present with RLS
     enabled via Supabase MCP `list_tables` before testing.
  4. Section 4 forged-write probe was run the strong way: a direct POST to
     the Supabase REST API (`/rest/v1/places`) using VISITOR's real session
     JWT extracted from cookies. Postgres rejected it: HTTP 403,
     `42501 — new row violates row-level security policy for table "places"`.
     RLS is the gate, not the UI.
  5. Ledger SQL spot-check matched the UI: 12 events for sections 2–3 plus
     `bridge.revoked` after section 7; `bridge.granted` metadata is `{}` —
     no emails or asset content anywhere in `audit_events.metadata`.
