# Steward Knowledge

> Stewards do not own knowledge.
> They are permissioned interfaces to island assets.

## Definition

A steward's knowledge consists of the island, places, and assets it has
permission to access. Knowledge is **derived at read time** — there is no
knowledge table, no embeddings, and no copied content. The existing `assets`
rows are the knowledge source; the steward is a lens over them.

## Scope rules

| Steward            | Knows                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Island steward (`place_id` is null) | Island-level information, plus all owner-visible places and assets on the island (until per-steward restrictions exist). |
| Place steward (`place_id` set)      | Its assigned place, and only the assets within that place. |

## The two gates

Every interaction with a steward passes through two filters, in order:

1. **Viewer gate (RLS).** All reads run through the requesting user's
   Supabase session. Row Level Security decides what *the viewer* may see:
   owners see everything on their island; bridged visitors see only
   `bridged` stewards, `bridged` places, and `bridged` assets on `bridged`
   places; everyone else sees nothing.
2. **Steward gate (scope).** `stewardKnowledge()` in
   [`src/lib/steward-knowledge.ts`](../src/lib/steward-knowledge.ts) then
   narrows the viewer-visible rows to the steward's assignment — the whole
   island for an island steward, a single place for a place steward.

The composition gives the bridged rule for free: a bridged visitor
interacting with a bridged steward can only ever surface bridged-visible
places and assets, because RLS already removed everything else before the
steward's scope was applied. The same steward "knows" more when its owner is
asking and less when a visitor is — knowledge is relative to who is at the
door.

**Consequently: knowledge queries must always use the viewer's session
client (anon key + auth cookie), never a service-role client.** A
service-role read would bypass gate 1 and let a steward leak private content
to a bridged visitor.

## What this is not (yet)

- **No knowledge table.** When stewards need curated or external knowledge,
  a table can be added; the scope rules here remain the outer boundary.
- **No per-steward restrictions.** "All owner-visible assets" is the MVP
  ceiling for island stewards; a future restriction mechanism can only
  narrow scope, never widen it past RLS.
- **No model connection.** `model_provider` / `model_name` are stored
  configuration. When a model is connected, the prompt context for a steward
  must be assembled exclusively from `stewardKnowledge()` output for the
  requesting user's session.
