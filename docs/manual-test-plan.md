# Manual Test Plan — Supabase Live Verification

Purpose: prove RLS, ownership, bridges, visibility, and audit behavior in a
real Supabase project. No AI connection, no public views, no uploads.

Date run: 2026-06-10  Tester: Claude Code (automated browser walkthrough)
Supabase project ref: wprjvtyzicxtngvxvpqm

## 0. Setup

- [x] Supabase project created (region of choice, free tier is fine)
- [x] **Email confirmation disabled** for this test run:
      Dashboard → Authentication → Sign In / Providers → Email →
      "Confirm email" OFF (otherwise signup detours through email)
- [x] All seven migrations applied **in this order** via SQL Editor
      (paste each file's contents and Run, one at a time — or run
      `setup-all.sql` once, which folds them all in):
  - [x] `20260610000000_islands_and_bridges.sql`
  - [x] `20260610010000_places.sql`
  - [x] `20260610020000_profiles_and_bridge_grants.sql`
  - [x] `20260610030000_assets.sql`
  - [x] `20260610040000_stewards.sql` (historical name; table is renamed below)
  - [x] `20260610050000_audit_and_provenance.sql`
  - [x] `20260610060000_rename_stewards_to_architects.sql`
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
