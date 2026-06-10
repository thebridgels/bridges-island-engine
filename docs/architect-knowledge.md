# Architect Knowledge

> Architects do not own knowledge.
> They are permissioned interfaces to island assets.

## What an Architect is

An Architect is the persistent AI presence that helps an owner design,
build, organize, govern, protect, and present an Island or Place.

- The Architect is **not** the owner.
- The Architect has **no authority above the owner**.
- The Architect operates **only within the permissions granted by the owner
  and enforced by the Island**.

## Definition

An architect's knowledge consists of the island, places, and assets it has
permission to access. Knowledge is **derived at read time** — there is no
knowledge table, no embeddings, and no copied content. The existing `assets`
rows are the knowledge source; the architect is a lens over them.

## Scope rules

| Architect            | Knows                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Island architect (`place_id` is null) | Island-level information, plus all owner-visible places and assets on the island (until per-architect restrictions exist). |
| Place architect (`place_id` set)      | Its assigned place, and only the assets within that place. |

## The two gates

Every interaction with an architect passes through two filters, in order:

1. **Viewer gate (RLS).** All reads run through the requesting user's
   Supabase session. Row Level Security decides what *the viewer* may see:
   owners see everything on their island; bridged visitors see only
   `bridged` architects, `bridged` places, and `bridged` assets on `bridged`
   places; everyone else sees nothing.
2. **Architect gate (scope).** `architectKnowledge()` in
   [`src/lib/architect-knowledge.ts`](../src/lib/architect-knowledge.ts) then
   narrows the viewer-visible rows to the architect's assignment — the whole
   island for an island architect, a single place for a place architect.

The composition gives the bridged rule for free: a bridged visitor
interacting with a bridged architect can only ever surface bridged-visible
places and assets, because RLS already removed everything else before the
architect's scope was applied. The same architect "knows" more when its owner is
asking and less when a visitor is — knowledge is relative to who is at the
door.

**Consequently: knowledge queries must always use the viewer's session
client (anon key + auth cookie), never a service-role client.** A
service-role read would bypass gate 1 and let an architect leak private content
to a bridged visitor.

## What this is not (yet)

- **No knowledge table.** When architects need curated or external knowledge,
  a table can be added; the scope rules here remain the outer boundary.
- **No per-architect restrictions.** "All owner-visible assets" is the MVP
  ceiling for island architects; a future restriction mechanism can only
  narrow scope, never widen it past RLS.
- **No model connection.** `model_provider` / `model_name` are stored
  configuration. When a model is connected, the prompt context for an architect
  must be assembled exclusively from `architectKnowledge()` output for the
  requesting user's session.
