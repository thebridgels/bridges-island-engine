# Asset Rights and Sovereign Creation — Design Outline

Status: **design only.** Nothing here is implemented; no code or migrations
accompany it. This document is the implementation outline behind
[constitution principle 8](bridges-constitution.md) ("Creations retain
identity, ownership, provenance, contribution history, and permissions") and
is bound by the rest of the constitution — especially no-god-mode (1),
sovereignty (3), bridges-are-limited (6), access-is-not-reuse (7), the
presence principles (11–12), and accountability (13).

It exists to make principle 8 concrete *and* to be honest about where
technical enforcement ends and provenance, license, and law begin.

## The spine: what the platform can and cannot make true

Two truths govern every section below.

1. **Inside Bridges, before view, permission is enforceable.** RLS already
   makes "you cannot open what you were not granted" real. A right the
   platform mediates — opening, copying through a platform action,
   transferring, exporting another's asset — can be genuinely gated.
2. **After view or export, technical prevention ends.** Once an authorized
   party has seen content, they can reproduce it; once content leaves
   Bridges, the platform cannot reach it. Beyond that line, "rights" mean
   provenance, license terms, and legal/social enforcement — never DRM the
   platform cannot deliver. The design must not promise otherwise.

## 1. Asset identity

- A durable asset identity that survives edit, derivation, and transfer
  (today `assets.id` is per-row and dies with the row).
- Distinguish the **asset** (the enduring creation) from its **revisions**
  (versions over time) — needed so provenance and ancestry have something
  stable to attach to.

## 2. Ownership

- Exactly one owner at any time (today: `owner_id`). Ownership is structural
  and never silently transferred (principle 2).
- Transfer is an explicit, logged, owner-initiated act that **carries
  provenance and history with it** — a transferred asset is not laundered
  into a fresh creation.

## 3. Contributors and joint creation

- A **contribution record** distinct from ownership: who (or what) added,
  edited, or materially shaped an asset, and when.
- Joint creation: multiple contributors, one owner (or a defined co-owner
  model — open question). Contribution history is durable and inseparable
  from the asset (principle 8).
- Contribution ≠ ownership ≠ accountability. A contributor is credited; the
  owner controls; the accountable actor (principle 13) is a human.

## 4. Provenance

- Extend today's `source_type` / `created_by_ai` / `source_note` into a
  durable chain that records origin and each material change, surviving
  derivation and transfer.
- Provenance is shown wherever the asset is shown, to anyone allowed to see
  the asset (consistent with current behavior in
  [provenance.md](provenance.md)).

## 5. AI participation

- AI may be a **contributor**, never an **owner** and never the terminal
  **accountable actor** (principles 10, 13). When an Architect contributes,
  the owner remains owner and a human remains accountable.
- AI contribution is permanently marked and carried on derivatives
  (`created_by_ai` lineage), consistent with principles 11–12: AI
  participation in a creation can never be concealed downstream.

## 6. Licenses and permission grants

- Grant types richer than today's binary `private` / `bridged`: explicit,
  separable grants attached to an asset (or a bundle), to a specific party
  (principle 6: specific, limited, revocable).
- A grant names what is permitted, to whom, and for how long; absence of a
  grant is denial (principle 3).
- A **public, or anonymous/aggregate, access mode** is itself a deliberate
  grant the owner enables, never a default; when enabled the interface must
  clearly identify it as such (principle 21). Visitor activity within an
  Island is visible to that owner and confined to that Island — never
  cross-Island profiling (principles 17, 21).

## 7. The action ladder: view < copy < modify < distribute < sell

- Each is a **separate** grant, independently allowed and revoked. Viewing
  grants nothing further (principle 7).
- **Enforceable inside Bridges:** view (RLS), and the *platform-mediated*
  forms of copy/modify/distribute/sell (no button, no API path, no export of
  another's asset without the grant).
- **Not enforceable after view/export:** a viewer reproducing content by
  hand or screen capture. The ladder governs what Bridges will *do on a
  party's behalf*, not what a determined viewer can physically prevent
  themselves from doing. Stated honestly so no grant implies a guarantee the
  platform cannot keep.

## 8. Cross-Island transfer

- A designed path to move an asset between Islands (today a composite FK ties
  an asset to one Island and its place). Transfer changes ownership/home
  while **preserving identity, provenance, contribution history, and
  ancestry** (principle 8).
- Transfer is owner-initiated on both ends, logged, and never silent.

## 9. Derivatives and ancestry

- A lineage graph: a derivative points to its parent(s); ancestry is
  queryable and inherited (including AI-contribution marks and any license
  terms that propagate).
- Open question: which permissions/licenses bind derivatives by default, and
  whether a parent's revocation reaches its derivatives (see §10).

## 10. Revocation

- Revoking a grant ends **future** platform-mediated access and actions.
- It **cannot un-view or recall** what was already seen or exported — the
  honest limit again. Revocation closes the door going forward; it does not
  reach into what already left.
- **Owner revocation** (above) is distinct from **platform disablement**.
  When a violation (e.g. principle 19) is established through transparent due
  process (principle 15), the platform may disable a *specific* Asset or
  function — its rendering, sharing, distribution, generation, or
  activation — without inspecting unrelated material and without
  dispossessing the owner of the Island (principles 1, 4). Disablement is the
  platform-mediated lever the action ladder (§7) already describes; it acts
  on the specific asset/function, never on the Island.
- Open question: revocation semantics for existing derivatives and for
  copies made under a now-revoked grant.

## 11. What "will not work without permission" can realistically mean

Inside Bridges, and only inside Bridges:

- An asset **will not open** for a party without a view grant (RLS — real
  today).
- An asset **will not copy, transfer, derive, distribute, or sell through any
  platform action** without the matching grant (designable — the platform
  controls its own surfaces).
- An Architect **will not surface** content the requesting session cannot see
  (already true: context is `architectKnowledge()` on the requester's
  session).

That is the real meaning: the platform refuses, through its own machinery, to
*act* without permission.

## 12. Honest limitations once content is viewed or exported

- Once a party is authorized to **view**, they can read, remember, transcribe,
  screenshot, and re-describe. No platform prevents this.
- Once content is **exported** (a right, principle 5) or **leaves** Bridges,
  it is beyond the platform's reach entirely.
- Past those lines, protection degrades from *prevention* to *attribution and
  recourse*: provenance travels with the work, licenses state the terms, and
  enforcement is legal and social — not technical.
- The platform must never imply a viewed or exported asset is technically
  locked. Promising un-keepable protection would itself violate the honesty
  the constitution demands.

## Open questions to resolve before building

- Co-ownership vs. single-owner-plus-contributors as the joint-creation
  model.
- Default license inheritance for derivatives, and whether parent revocation
  reaches derivatives.
- Whether conversations/Architect outputs become assets with these rights,
  or stay interaction records (the architect-chat plan deferred this).
- How licenses interact with cross-Island transfer when source and
  destination owners differ.
- Where the rights ladder sits relative to bridge granularity (principle 6's
  current island-scope caveat in the enforcement map).
