# Provenance and the Ledger

The trust layer answers three questions about everything on an island:
**who made it, where it came from, and who changed it.**

## Who made it

Every island, place, asset, and architect carries its maker in the schema:
`islands.owner_id`, `assets.owner_id`, and `architects.owner_id` reference
`auth.users`, and places belong to exactly one island (and so one owner).
Ownership is structural — it is set at creation, enforced by RLS
(`with check` policies require the creator to be the caller), and never
transferred silently.

## Where it came from

Assets carry provenance fields (added in
[`20260610050000_audit_and_provenance.sql`](../supabase/migrations/20260610050000_audit_and_provenance.sql)):

| Field | Meaning |
| ----- | ------- |
| `source_type` | `original` (made here), `uploaded`, `ai_generated`, `imported`, or `linked`. |
| `created_by_ai` | True when AI produced the content, regardless of how it arrived. An `uploaded` file can still be AI-made. |
| `source_note` | Optional free text for the human story: "scanned from the family archive", "generated 2026-06 with Claude". |

Provenance is shown wherever the asset is shown — including to bridged
visitors, who see the provenance of any asset they're allowed to see.
Honesty about origin travels with the content; this matters most for
`ai_generated` assets and, later, for anything architects produce.

## Who changed it

`audit_events` is each island's **ledger**: an append-only record of every
major owner action — building, reshaping, and removing places; adding,
changing, and removing assets; appointing, reassigning, and dismissing
architects; raising and withdrawing bridges; exporting the island
(`export.island`).

Each event records the island, the actor, the action, the target
(`target_type` + `target_id`), a `metadata` JSON blob, and a timestamp.
Metadata is deliberately minimal and non-sensitive: display names and
source types only — never asset content, never email addresses.

### Access rules

- **Owners** read their island's ledger at `/islands/<id>/audit`.
- **Bridged users cannot read audit events at all.** The ledger records the
  owner's governance of the island; visitors are not entitled to it. The
  audit page 404s for non-owners, and RLS returns zero rows regardless.
- **Nobody can edit history.** Inserts require the actor to be the caller
  and the island's owner; there are no update or delete policies, so the
  log is append-only through the API.

### How events are written

Server actions call `logAuditEvent()`
([`src/lib/audit.ts`](../src/lib/audit.ts)) after a successful mutation,
through the caller's own session — never a service role. Logging is
best-effort by design: a failed log write never breaks the action it
describes. One consequence to know: when a bridged grantee removes their
own bridge (allowed by RLS), no event is written, because they cannot
write to an island ledger they don't own.

## Taking it with you

Provenance and the ledger travel with the island: the owner-only Export
(`/islands/<id>/export`) produces a JSON snapshot that includes every
asset's provenance fields and the full audit ledger. The export is part of
ownership — it is generated through the owner's own RLS-enforced session
(never service-role access), contains no platform secrets, and is itself
recorded in the ledger as `export.island`.

## Later

- Architect actions (once models are connected) must be logged with the
  architect as identifiable context in `metadata`, so AI activity is
  distinguishable from owner activity.
- Asset content versioning (true "what changed", not just "that it
  changed") would build on the same ledger.
