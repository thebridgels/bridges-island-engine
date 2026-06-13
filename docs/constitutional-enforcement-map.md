# Constitutional Enforcement Map

A companion to [bridges-constitution.md](bridges-constitution.md). For every
principle, this map states honestly **how far it is actually enforced today**
and **by what mechanism**. A commitment that is not yet enforced is still
binding; this document records the gap rather than hiding it.

## Classification key

- **Enforced now** — a concrete mechanism (RLS, schema constraint, route
  guard, structural absence) makes the principle true today.
- **Partly enforced** — a mechanism covers part of the commitment; named
  gaps remain.
- **Documented, not enforced** — written and intended; no mechanism yet.
- **Not yet designed** — accepted as binding, but no design exists.
- **Operational / business commitment** — a promise about conduct, not a
  thing software can enforce; upheld by policy and restraint.

## Map

| # | Principle | Class | Mechanism today / gap |
|---|-----------|-------|------------------------|
| 1 | No God-Mode Access | **Enforced now** | Anon key + user session only; no service-role key in app or env; all access through RLS in `supabase/migrations/`. |
| 2 | Island Ownership and Responsibility | **Enforced now** | `owner_id → auth.users`; `with check` insert policies; owner-exclusive mutation of places/assets/architects/visibility/bridges. Ownership transfer and governance: not built. |
| 3 | Island sovereignty / private by default | **Enforced now** | RLS default-deny; policies are `to authenticated` only — no `anon` role anywhere; an Island is visible only to its owner or a bridge-grantee. |
| 4 | Owner is never locked out | **Partly enforced** | RLS guarantees the owner always reads/writes their own rows; Export exists. Gaps: the enforcement system that would restrict *outward* function (bridges/publication/commerce/a specific asset) without touching the owner's entry is **not yet designed**; account recovery and infra-outage handling are out of scope here. The absolute itself is honored by design — no code path dispossesses an owner. |
| 5 | Right to export and to leave | **Partly enforced** | Export ✓: owner-only `/islands/<id>/export`, full JSON snapshot through the owner's session, logged `export.island`. "Leave" ✓ at the row level (`on delete cascade`) but with **no off-boarding flow** — graceful account departure is not yet designed. |
| 6 | Bridges specific, limited, revocable | **Enforced now** | `bridges` table; owner-only grant (`is_island_owner` + `granted_by = auth.uid()`); `delete` = revoke; grantee gets read-only and cannot re-grant. **Granularity caveat:** a bridge currently conveys whole-island access to bridged-visible content, not per-place/per-asset grants — "limited" holds at island scope, not yet at fine scope. |
| 7 | Access is not ownership or reuse | **Partly enforced** | Enforced *on platform surfaces*: a viewer has no copy, transfer, or re-grant affordance, and cannot export another's Island. **Unenforceable beyond view** (honest limit): once authorized to see content, a party can reproduce it out-of-band — protection there is provenance + license + law, designed in [asset-rights-design.md](asset-rights-design.md). |
| 8 | Creations retain identity/ownership/provenance/contribution/permissions | **Partly enforced** | Have: `owner_id` (ownership), `source_type`/`created_by_ai`/`source_note` (provenance), `visibility` (permissions). **Missing**: durable identity across transfer, contribution history / joint creation, and the rights ladder — all specified in [asset-rights-design.md](asset-rights-design.md), none built. |
| 9 | Architects answer only to the owner | **Enforced now** | Architects are owner-CRUD; configuration and command are owner-only; phase-1 chat is owner-only (404 for non-owners). Visitor conversation (phase 2) will be an owner-granted permission; allegiance stays with the owner by construction. |
| 10 | Intelligence confers no authority | **Enforced now** | Architects have no tools, no function calling, no write path — "context in, text out." No capability-derived authority exists to leak. |
| 11 | Every presence classified Human/AI/Bot | **Not yet designed** | Only *content-level* AI marking exists (`created_by_ai` on assets and architect messages). There is no presence/account-level classification and no "Bot" concept. Needs a dedicated design pass (definition of a presence, immutability at creation, later verified/unverified-human distinction). |
| 12 | Appearance fictional; classification not concealed | **Partly enforced** | The **AI slice holds**: every Architect reply is displayed AI-marked and `created_by_ai` is CHECK-constrained to the architect role, so AI cannot be stored as human. The **general disclosure mechanism** (any presence's classification always surfaced to a viewer) depends on principle 11 and is not yet designed. |
| 13 | Every meaningful action has an accountable actor | **Partly enforced** | `audit_events.actor_id` ties logged actions to a human; architect replies are attributed to the requesting human (actor, not author). Gaps: logging is app-level and best-effort (a future code path could omit it), and not every action type (notably reads) is actored. |
| 14 | Owner notified of actions affecting the Island | **Partly enforced** | An append-only ledger exists and the owner can inspect it at `/audit`; owner-initiated Architect chat records the provider/model used (`architect_messages`). But the constitutional bar is **active notification**, and the ledger is **pull, not push**. Gaps: no push channel; contemporaneous provider/scope disclosure at Architect invocation is not yet built; the rule that out-of-scope / different-provider / non-owner-initiated provider access *must* actively notify is not yet built; **outside reads** (visitors, AI providers, administrators, integrations) are not yet captured. Owner-initiated, contemporaneously disclosed provider access correctly needs no separate alarm — but the disclosure surface that makes it "disclosed" isn't built yet. |
| 15 | No anonymous accusation; due process | **Not yet designed** | No reporting, moderation, dispute, or enforcement system exists. When built, it must carry accuser identity, allegation, evidence, and decision-maker, per the principle. |
| 16 | No hidden master key; honest infrastructure access | **Enforced now (app) + disclosed carve-out (infra)** | The application has no service-role key and no back door — enforced. The hosting stack (Supabase) does include a `postgres`/dashboard role held by the platform operator; this is **disclosed**, committed to maintenance-only and never-to-bypass-an-owner, but is **not yet bounded by independent audit tooling**. The constitution states this plainly rather than claiming the capability does not exist. |
| 17 | No selling data; no surveillance/advertising/influence profiles | **Operational / business commitment** | Enforced by absence today: no advertising, profiling, or data-sale code exists; `profiles` is an email→id lookup, not a behavioral profile; the ledger is names-only. The commitment is a promise about purpose, not a mechanism — security/operation/audit/abuse records are allowed; repurposing them is forbidden. |
| 18 | No secret action against an owner; withdraw from compelling jurisdictions | **Operational / business commitment** | Not codeable. Structurally supported by no-god-mode (secret access is hard when access runs through the owner's session and the ledger), but "refuse and withdraw" is a governance posture, not software. |
| 19 | No pornography anywhere | **Mixed: refusal enforceable now; reactive enforcement not yet designed** | Scope is honest: the commitment is that Bridges will not **knowingly** generate, serve, display, distribute, sell, activate, or facilitate pornography — not a claim of omniscience over private space it may not inspect (principle 1). The **refuse-to-generate/serve** duty binds Architects and platform tooling immediately (no feature may produce or assist it). **Reactive enforcement** — a non-anonymous party with legitimate access reports; transparent due process establishes the violation (principle 15); Bridges then disables that *specific* Asset/function from rendering/sharing/distribution/generation/activation, without inspecting unrelated material or locking the owner out (principle 4) — depends on the principle-15 system and is **not yet designed**. No proactive scanning exists or is permitted. |
| 20 | Protection of dignity and personhood | **Operational / aspirational** | No moderation or reporting exists yet; this is the human floor that the due-process (15) and presence (11) systems will operationalize. Today it is a binding commitment without a mechanism. |
| 21 | Visitor visibility within an Island; no tracking beyond it | **Partly enforced** | Within-Island actorship exists in the ledger; RLS confines every record to its own Island, so cross-Island profiling has no data path (principle 17). Gaps: **pre-crossing visitor disclosure** ("your identity and activity here are visible to the owner") is not built; full **read-actorship** (capturing visitor reads, not just writes) is not built; owner-scoped **cross-Island review of the same identified visitor** is not built; an **owner-enabled read-only public / anonymous-or-aggregate mode** does not exist (today there is no anonymous access at all — principle 3). The "anonymous may observe, not act" rule holds trivially now (no anonymous access and no visitor writes exist), and becomes a real design constraint the moment either ships. |
| 22 | No improvised governance before its systems exist | **Operational commitment, honored now** | True by construction: no discretionary governance mechanism exists, so none is being improvised. The boundaries operating today need no discretion — RLS denial (1, 3) and Architect refusal (10, 19). Discretionary enforcement (4's outward restrictions, 19's reactive disablement) is intentionally withheld until notification (14), attributable reporting/no-anonymous-accusation (15), evidence, review, and appeal exist. The alpha stays private/bridged; future public/semi-public activity (Part IX) is anticipated but deferred to its governance. |
| 23 | Self-declared identity and contextual presentation | **Operational commitment + not yet designed** | Honored by absence today: Bridges performs no inference or exposure of personal facets, and there is no profiling. The affirmative model — per-context facets, presence in one Place not exposing the Island — has no mechanism yet; it is part of the deferred Future-design work below. |
| 24 | Declared intent, not behavioral targeting | **Operational commitment + not yet designed** | Honored by absence today: no behavioral targeting, browsing history, tracking, income inference, or prediction exists anywhere in the app. The affirmative declared-interest mechanism (users state what they want; responders bounded to the opened scope; browsing/silence/presence ≠ consent) is not yet designed. |
| 25 | Recipient-controlled commercial communication | **Not yet designed** | No commercial-communication feature exists. When built it must carry recipient-set controls (categories, who, limits, duration, geography, Human/AI/Bot, follow-up), per-message commercial + responsible-party + classification disclosure, and a hard bar on widening or reselling declared interests (17, 24). Honored by absence until then. |
| 26 | Voluntary offering and discovery | **Not yet designed** | No publishing, search, or discovery feature exists. The no-auto-exposure commitment (nothing leaves an Island because it merely exists privately — 3, 6) is honored by absence today; voluntary, declared-interest-driven discovery without engagement optimization is deferred to Future-design work. |

## First recommended implementation correction after adoption

The newest principle that touches **already-shipped code** is #14's
requirement that owner-initiated Architect chat **contemporaneously disclose
the provider/model and the permitted Island scope at the moment of
invocation**. Live Architect Chat today records the model used and marks
replies AI, but it does **not** present that provider/model + scope
disclosure at send-time, so it is only *partly compliant* with #14 as now
written.

This is the **first recommended implementation correction** once these
principles are adopted. It is a disclosure-surface addition (UI text plus
surfacing the resolved provider/model and scope) — **no security-model or
data-flow change** — and no code is changed by this documentation task.

## Future design required

Part IX (principles 23–26) and parts of 21 describe voluntary public and
semi-public activity that **does not exist in the system yet** and must not
be improvised (principle 22). When that work begins, it belongs in a
dedicated design document (not in [asset-rights-design.md](asset-rights-design.md),
which stays scoped to asset rights), covering:

- contextual identity facets (principle 23);
- declared needs and offerings (principles 24, 26);
- recipient-controlled commercial communication (principle 25);
- public and shared meeting Places (principles 21, 23);
- voluntary social and dating discovery (principles 23, 24).

That document is intentionally **not created yet** — naming the scope here is
enough to keep the constitution honest without pre-committing a design.

## Honest summary

- **Strongest today (enforced now):** sovereignty, no-god-mode, owner
  ownership, bridge mechanics, architect allegiance, and "intelligence
  confers no authority." These rest on RLS and structural absence of
  capability — the hardest kind of enforcement to regress.
- **Real but partial:** the owner-never-locked-out absolute, export/leave,
  access-is-not-reuse, creation rights, accountable-actor, the AI slice of
  presence disclosure, and visitor visibility (21). Each has a concrete
  mechanism and a named, honest gap.
- **Not yet designed:** presence classification (11), general
  classification disclosure (12), due process (15), and reactive private
  content enforcement (19). These are binding commitments awaiting design.
- **Operational commitments:** no-surveillance/no-sale (17), no-secret-
  action/withdrawal (18), dignity (20), the disclosed infrastructure
  carve-out within (16), no-improvised-governance (22), and the
  honored-by-absence intent/identity commitments (23, 24). Upheld by
  conduct and restraint, not by code — and labeled as such rather than
  dressed up as enforcement.
- **Anticipated but not yet designed (Part IX):** self-declared identity
  and contextual facets (23), declared intent over targeting (24),
  recipient-controlled commercial communication (25), and voluntary
  offering/discovery (26). These are binding forward commitments; their
  design is deferred to the dedicated document named under "Future design
  required," and principle 22 forbids shipping the activity before its
  governance.

**The sequencing rule (22) is the meta-discipline of this map.** Several
principles grant Bridges discretionary power — restricting outward function
(4), disabling a reported Asset (19) — that may be exercised *only* through
systems this map lists as not-yet-designed (notification 14, due process
15). Until those exist, that discretionary power stays unused; the only
enforcement running today is the kind that needs no judgment: RLS denial
and Architect refusal. The gaps in this map are therefore not latent
permissions to act informally — they are commitments to wait.

The map is expected to change as features land. The principles are not.
