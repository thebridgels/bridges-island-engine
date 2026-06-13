# The Bridges Constitution

Principles that govern how Bridges is built. Code, schema, and features may
change freely; these may not be violated by any of them. New principles are
added by the owner of this project, not inferred.

Each principle states a **commitment** — timeless, binding on every future
change. Implementation detail is deliberately kept separate: principles #1
and #2 carry their original "As enforced today" blocks, and every principle
adopted afterward carries a short `Status` line pointing to the companion
[constitutional-enforcement-map.md](constitutional-enforcement-map.md),
which classifies each one as enforced, partly enforced, documented,
not-yet-designed, or an operational commitment. A commitment that is not yet
enforced is still binding; the map records the gap honestly rather than
pretending it shut.

Principles #1 and #2 were adopted 2026-06-10. Principles #3–#26 were adopted
2026-06-13. They are grouped into thematic Parts for reading; the numbers,
not the Parts, are the stable references.

## 1. No God-Mode Access

*Adopted 2026-06-10 at the owner's explicit request.*

Normal access to an Island must occur through the identity and permissions
of the person or agent requesting access.

Bridges must not use unrestricted administrative access for ordinary
user-facing reads, writes, architect knowledge, bridge visibility, or model
context assembly.

Service-role or administrative access, if ever introduced, may only be used
for narrowly scoped maintenance tasks, never to bypass an Island owner's
permissions.

The Island's boundaries must be enforced by the database, not merely by
application promises.

### As enforced today

- Every Supabase client in the app uses the anon key plus the requesting
  user's session (`src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`,
  `src/proxy.ts`). No service-role key exists in the codebase or its
  environment files.
- All boundaries live in Row Level Security policies in
  [`supabase/migrations/`](../supabase/migrations/) — islands, places,
  assets, architects, bridges, profiles, and the audit ledger are each
  protected at the database layer, so a bug in application code cannot
  widen access.
- Architect knowledge is derived through the viewer's session
  ([architect-knowledge.md](architect-knowledge.md)), and audit logging records
  the requesting user's identity through their own session
  ([provenance.md](provenance.md)). When model context assembly arrives, it
  inherits this rule: context is built exclusively from what the requesting
  identity may see.

## 2. Island Ownership and Responsibility

*Adopted 2026-06-10 at the owner's explicit request.*

Each Island is owned by its owner.

The owner controls the Island, determines its structure, governs access,
chooses what is private or visible, and decides which Bridges may connect
to it.

Because the Island belongs to the owner, the owner is responsible for the
materials, actions, representations, transactions, and permissions
originating from that Island.

Bridges does not claim ownership of an Island or its contents.

Bridges provides the infrastructure through which Islands may be created,
protected, connected, and visited.

Bridges is responsible for maintaining the integrity of the platform,
enforcing permission systems, protecting user access, and honoring the
constitutional boundaries of Islands.

Ownership creates authority.

Authority creates responsibility.

### As enforced today

- Ownership is structural, not declarative: `islands.owner_id`,
  `assets.owner_id`, and `architects.owner_id` reference `auth.users`, and
  RLS `with check` policies require the creator to be the caller. There is
  no mechanism by which the platform, or any other user, becomes an owner
  of an Island's contents.
- The owner's control is exclusive at the database layer: only the owner
  can create, change, or remove places, assets, and architects; only the
  owner can set `private`/`bridged` visibility; only the owner can grant a
  bridge ([provenance.md](provenance.md), the RLS policies in
  [`supabase/migrations/`](../supabase/migrations/)).
- The responsibility trail exists: every major owner action is recorded in
  the island's append-only audit ledger under the owner's own identity,
  and assets carry owner-declared provenance.
- The platform side of the bargain is principle 1: boundaries enforced by
  the database, no god-mode access, identity preserved on every action.

Not yet enforced (and intentionally not claimed): ownership transfer,
account-level governance, terms of service, and liability terms do not
exist yet. This principle documents the model; it is not a legal
instrument.

---

**Part I — Sovereignty and the Owner's Inviolable Access** *(principles 3–5,
extending principle 2)*

## 3. Island Sovereignty and Private by Default

*Adopted 2026-06-13 at the owner's explicit request.*

An Island is private by default. Nothing on an Island is visible to anyone
but its owner unless the owner deliberately makes it so.

There is no ambient, public, or anonymous access to an Island. Visibility is
granted, never assumed; the absence of a grant is a denial, not an
oversight.

Sovereignty is the rule from which the Bridges (Part II), creation (Part
III), and presence (Part IV) principles follow: an Island is the owner's
territory, and every connection into it is an exception the owner chose.

`Status:` enforced now — see the enforcement map.

## 4. The Owner Is Never Locked Out

*Adopted 2026-06-13 at the owner's explicit request.*

An owner may never be locked out of their Island. This is absolute.

Enforcement against misconduct may restrict what flows **outward** from an
Island — outward Bridges, publication, distribution, commerce, integrations
— or may disable a specific prohibited Asset or function. Enforcement may
not dispossess the owner of the Island, and may not deny the owner access
to the rest of their workspace, their records, their Architects, or their
export.

The owner's relationship to their own Island is not suspended, escrowed, or
held hostage as leverage. A restriction is a closed outward door, never a
seized home. There is no "account suspension that also withholds your data"
posture here: whatever else is restricted, the owner retains entry to their
Island and the means to take it with them (principle 5).

`Status:` partly enforced — see the enforcement map.

## 5. The Right to Export and to Leave

*Adopted 2026-06-13 at the owner's explicit request.*

An owner may take their Island with them and leave at any time.

Export is a right, not a courtesy: the owner can obtain a faithful copy of
their Island — its structure, contents, provenance, Architects, and records
— in a portable form, generated through their own session, containing no
platform secrets. Leaving is likewise a right: the owner may remove their
Island from the platform.

Export is the concrete guarantee behind principle 4: because the owner can
always retrieve and depart, no restriction can become a trap.

`Status:` partly enforced — see the enforcement map.

---

**Part II — Bridges and Access** *(principles 6–7)*

## 6. Bridges Are Specific, Limited, and Revocable

*Adopted 2026-06-13 at the owner's explicit request.*

A Bridge is a specific connection the owner extends to a specific other
party. It is limited to what the owner grants, and it is revocable at the
owner's will.

A Bridge is not a key to the whole Island, not transferable by the party who
received it, and not permanent. Revocation ends future access. What a party
already saw cannot be un-seen — the platform is honest about this (principle
7 and [asset-rights-design.md](asset-rights-design.md)) — but the connection
itself closes the moment the owner withdraws it.

`Status:` enforced now (revocable, owner-only, limited scope) — see the
enforcement map for the granularity caveat.

## 7. Access Is Not Ownership, Nor Permission to Reuse

*Adopted 2026-06-13 at the owner's explicit request.*

Being granted access to something does not make it yours, and does not grant
permission to copy, reuse, redistribute, or sell it.

A Bridge lets a party *see* what the owner shared, within the owner's terms.
It conveys no ownership, no license, and no reuse right beyond what the owner
explicitly grants. Permission to view is the narrowest grant; copy, modify,
distribute, and sell are separate, each requiring its own explicit grant
([asset-rights-design.md](asset-rights-design.md)).

Inside Bridges, the platform refuses reuse it was not asked to allow: there
is no copy, transfer, or re-grant affordance for a mere viewer. Once content
has been viewed by an authorized party, technical prevention of copying
ends; beyond that point the protection is provenance, license, and law — not
a promise the platform cannot keep.

`Status:` partly enforced — see the enforcement map.

---

**Part III — Creation** *(principle 8)*

## 8. Creations Retain Identity, Ownership, Provenance, Contribution History, and Permissions

*Adopted 2026-06-13 at the owner's explicit request.*

A creation on Bridges carries, durably and inseparably: its own identity;
its ownership; its provenance (where it came from and how it was made); its
contribution history (who and what contributed, including AI); and its
permissions (what may be done with it, by whom).

These travel with the creation across edits, derivation, and transfer
between Islands. A creation is never reduced to anonymous content stripped of
who made it and on what terms.

The concrete design — asset identity, contributors and joint creation,
provenance chains, AI participation, licenses, the
view/copy/modify/distribute/sell ladder, cross-Island transfer, derivatives
and ancestry, revocation, and the honest limits of "will not work without
permission" — is specified in
[asset-rights-design.md](asset-rights-design.md). This principle is the
commitment; that document is the implementation outline.

`Status:` partly enforced (ownership, provenance, permissions exist;
durable identity, contribution history, and the rights ladder are designed,
not built) — see the enforcement map.

---

**Part IV — Intelligence and Presence** *(principles 9–12)*

## 9. Architects Answer Only to the Island Owner

*Adopted 2026-06-13 at the owner's explicit request.*

An Architect's allegiance is to the Island's owner alone. Only the owner
commands an Architect, sets its purpose, and may delegate authority over it.

This is allegiance, not isolation. The owner may permit visitors to converse
with an Architect; such interaction is itself a permission the owner grants.
But conversing with an Architect never transfers its loyalty or authority to
the visitor. An Architect serves the owner's interests even while speaking
with someone else, and it carries no power the owner did not give it.

`Status:` enforced now (owner-only command and configuration; phase-1 chat
is owner-only) — see the enforcement map.

## 10. Intelligence Confers No Authority

*Adopted 2026-06-13 at the owner's explicit request.*

An AI receives no authority merely because it is intelligent, capable, or
persuasive.

Authority on Bridges comes only from the owner's grant, enforced by the
Island's boundaries. An Architect's competence is never a reason to let it
act beyond its permissions. Capability is not consent; intelligence is not a
mandate.

`Status:` enforced now (Architects have no tools and no write path) — see
the enforcement map.

## 11. Every Presence Is Permanently Classified as Human, AI, or Bot

*Adopted 2026-06-13 at the owner's explicit request.*

Every presence that can act or speak on Bridges is classified as Human, AI,
or Bot, and that classification is persistent and enforced by the system.

- **Human** means directly operated by a person. It does not require
  government-ID verification; the system may later distinguish *verified*
  from *unverified* humans, but a person operating their own presence is
  Human regardless.
- **AI** means a model-driven presence (such as an Architect).
- **Bot** means automated, non-human, non-model agency.

AI and Bot classification is permanent and system-enforced: an automated or
model-driven presence can never present itself as, or be reclassified into, a
Human.

`Status:` not yet designed at the presence level (content-level AI marking
exists) — see the enforcement map.

## 12. Appearance May Be Fictional; Identity Classification May Not Be Concealed

*Adopted 2026-06-13 at the owner's explicit request.*

A presence may wear any name, persona, or appearance it likes. What it *is* —
Human, AI, or Bot (principle 11) — may never be hidden, faked, or stripped
away.

Fiction of appearance is welcome; concealment of classification is
forbidden. An AI may be a character with a name and a voice, but it may never
pass as human, and a viewer is always entitled to know the classification of
whatever they are interacting with.

`Status:` partly enforced for AI (Architect replies are always marked AI and
the marking is CHECK-constrained); the general presence-disclosure mechanism
is not yet designed — see the enforcement map.

---

**Part V — Accountability, Notification, and Due Process** *(principles
13–15)*

## 13. Every Meaningful Action Has an Accountable Actor

*Adopted 2026-06-13 at the owner's explicit request.*

Every meaningful action on Bridges is attributable to an accountable actor —
ultimately a human or a clearly identified entity.

An AI is never the terminal accountable party (principle 10): when an
Architect produces something, the accountable actor is the human whose
authority and request caused it. Actions do not happen on Bridges without
someone answerable for them. Anonymous, unattributable, or orphaned action
is not permitted.

`Status:` partly enforced (logged actions carry an actor; logging is
app-level and does not yet cover all action types) — see the enforcement
map.

## 14. The Owner Is Notified of Actions Affecting the Island

*Adopted 2026-06-13 at the owner's explicit request.*

The owner is notified of actions affecting their Island. The constitutional
requirement is **active notification** — the owner is informed — not merely
the existence of a record the owner could go and inspect.

Actions affecting the Island include outside reads: access by visitors, by
AI providers, by administrators, and by integrations all count and are
notifiable. The owner's own ordinary reads of their own Island do not
require notification.

**Owner-initiated AI-provider access is a disclosed read, not a separate
alarm.** When an owner knowingly invokes an Architect, the interface must
disclose the provider/model and the permitted Island scope at the moment of
invocation, and the request must record the provider/model used and that
authorized context was transmitted. That record remains inspectable in the
owner's ledger. Because it is contemporaneously disclosed and directly
initiated by the owner, it does **not** require a separate interruptive
notification. Active notification **is** required whenever provider access
occurs without direct owner action, exceeds the disclosed scope, uses a
different provider, or otherwise departs from what the owner authorized.

The access logging that makes this possible exists for the owner's
accountability and awareness. It must never be repurposed into advertising,
influence profiling, or surveillance commerce (principle 17).

`Status:` partly enforced — an append-only ledger exists and is inspectable
by the owner, and owner-initiated Architect chat records the model used; but
notification is pull, not push, contemporaneous provider/scope disclosure at
invocation is not yet built, and outside-read coverage (visitors, providers,
admins, integrations) is not yet built. See the enforcement map.

## 15. No Anonymous Accusation; Due Process for the Accused

*Adopted 2026-06-13 at the owner's explicit request.*

No one is accused anonymously on Bridges. A party subject to a complaint,
report, or enforcement action is entitled to know: the identity of the
accuser, the allegation, the evidence, and the decision-maker.

Enforcement is transparent and attributable on both sides. The accuser is
named; the process is disclosed; the accused can answer. Secret reports,
hidden evidence, and faceless decision-makers have no place here. This is the
due-process backbone of content governance (principle 19) — including the
handling of any report against private content, which is governed by this
principle and bounded by principle 1.

`Status:` not yet designed — see the enforcement map.

---

**Part VI — Platform Restraint** *(principles 16–20, extending principle 1)*

## 16. No Hidden Master Key; Honest Infrastructure Access

*Adopted 2026-06-13 at the owner's explicit request.*

No hidden or ordinary god-mode path may exist for access to an Island.
Routine access — reads, writes, knowledge, context — flows only through the
requesting identity's permissions (principle 1).

Bridges does not pretend that privileged infrastructure capability does not
exist when the hosting stack has it. The current stack (a hosted Postgres
platform) includes infrastructure-level database access that the platform
operator holds. The commitment is honest and bounded: any such unavoidable
capability must be **disclosed**, **narrowly bounded** to maintenance,
**auditable**, and **never used for routine access or to bypass an owner**.
What is forbidden is a secret key and an ordinary back door; what is
acknowledged is that operating a database is not the same as having no
privileged capability at all.

`Status:` enforced now at the application layer; the infrastructure
capability is disclosed and bounded by commitment, not yet by independent
audit tooling — see the enforcement map.

## 17. No Sale of Personal Data; No Surveillance, Advertising, or Influence Profiles

*Adopted 2026-06-13 at the owner's explicit request.*

Bridges does not sell personal data and does not build surveillance,
advertising, or influence profiles of the people who use it.

Records necessary for security, operation, owner audit, and abuse response
are permitted — they are how principles 13, 14, and 15 are kept. Those
records may never be repurposed into behavioral, advertising, commercial, or
influence profiles. The line is purpose: accountability and protection are
allowed; monetized observation of people is not.

`Status:` operational/business commitment (enforced by absence today) — see
the enforcement map.

## 18. No Secret Action Against an Owner; Withdrawal From Jurisdictions That Compel It

*Adopted 2026-06-13 at the owner's explicit request.*

Bridges refuses to act secretly against an owner. If a jurisdiction compels
Bridges to take hidden action against an owner — covert access, secret
surveillance, undisclosed seizure — Bridges withdraws from that jurisdiction
rather than comply in secret.

The owner's right to know what is done to their Island (principle 14) and to
face any accusation openly (principle 15) does not have a silent exception.
Transparency is not suspended on demand.

`Status:` operational/business commitment — see the enforcement map.

## 19. No Pornography Anywhere on the Platform

*Adopted 2026-06-13 at the owner's explicit request.*

Bridges will not knowingly generate, serve, display, distribute, sell,
activate, or facilitate pornography anywhere on the platform.

This is a commitment about **what Bridges knowingly supports and permits**,
not a claim of omniscience. Bridges does not claim that prohibited bytes can
never exist undetected inside private space it is constitutionally forbidden
to inspect (principle 1). "No pornography anywhere" governs the platform's
own knowing conduct — generation, serving, display, distribution, sale,
activation, facilitation — not a guarantee to see into private Islands it has
promised not to search.

The prohibition is enforced without creating surveillance of private Islands.
Specifically:

- There is **no god-mode inspection exception**. The platform does not scan
  private Islands looking for violations; principle 1 is not weakened to
  enforce this one.
- Architects and platform tools must **refuse to generate or facilitate**
  pornography. The platform will not be a party to creating it.
- **Public and shared material may be governed directly** — what is
  published or bridged outward is within reach of ordinary governance.
- **Private violations may be addressed only when encountered and reported**
  by an attributable, non-anonymous person or entity with legitimate access
  (never by proactive scanning, never by an anonymous report — principle
  15).
- When prohibited material is legitimately encountered and **established
  through transparent due process** (principle 15), Bridges may **disable
  that specific Asset or function** from rendering, sharing, distribution,
  generation, or activation. It may **not** inspect unrelated private
  material, and may **not** lock the owner out of the Island (principle 4).
- **Review and action must be transparent, attributable, and disclosed to
  the owner** (principles 14 and 15).

`Status:` mixed — the refuse-to-generate/serve duty binds tooling now;
reactive, attributable enforcement depends on the principle-15 due-process
system and is not yet designed. See the enforcement map.

## 20. The Dignity and Personhood of Individuals Is Protected

*Adopted 2026-06-13 at the owner's explicit request.*

Bridges protects the dignity and personhood of individuals. The platform is
not a venue for the degradation, dehumanization, or exploitation of real
people.

This principle is the human floor beneath the others: ownership, expression,
and fiction (principle 12) are wide, but they do not extend to using Bridges
to strip a real person of their dignity or personhood. Where dignity and some
other interest collide, dignity is the floor that holds.

`Status:` operational/aspirational; depends on the due-process (15) and
presence (11) systems — see the enforcement map.

---

**Part VII — Visitor Visibility and Owner Accountability** *(principle 21,
pairing with principles 14 and 17)*

## 21. Visitor Visibility Within an Island; No Tracking Beyond It

*Adopted 2026-06-13 at the owner's explicit request.*

The owner has the right to know who enters their Island and what protected
Places or Assets they access. Within an Island, a visitor has no anonymity
from that Island's owner regarding the actions they take there.

Because this is so, the obligation runs both ways: **before crossing a
Bridge, a visitor must be clearly informed** that their identity and their
activity within that Island are visible to the owner. Visibility is disclosed
in advance, never sprung afterward.

This visibility is strictly bounded:

- It is **limited to that Island**. The owner sees activity within their own
  Island and nothing beyond it; owners receive no activity from Islands they
  do not own.
- An owner **may recognize and review the same identified visitor's activity
  across Islands that owner owns** — but each record stays associated with
  the Island where the action occurred. Bridges must **not** automatically
  construct a generalized, cross-Island behavioral profile from this, and
  these records may not be repurposed for advertising, influence scoring,
  resale, or unrelated surveillance (principle 17).
- A **public or shared meeting Place does not create a right to inspect a
  visitor's Island.** Social discovery is voluntary and rests only on what
  each participant chose to disclose (principle 23).
- **Public, or anonymous/aggregate, access may exist only when the Island
  owner deliberately enables such a mode**, and the interface clearly
  identifies it as such. Absent that deliberate choice, there is no anonymous
  access (principle 3).

**Anonymous or aggregate access is strictly read-only.** It may permit
*viewing* material the owner deliberately exposes through that mode. It may
not permit writing, editing, uploading, messaging, reporting, purchasing,
voting, commanding an Architect, changing state, or any other attributable
action. The moment a presence acts, it must operate under a persistent
Human, AI, or Bot classification (principles 11, 13).

> **Anonymous access may observe. It may not act.**

`Status:` partly enforced — within-Island actorship exists in the ledger and
RLS confines records to their Island (cross-Island profiling has no data
path); pre-crossing visitor disclosure, owner-scoped cross-Island review, an
owner-enabled read-only public/anonymous mode, and full read-actorship are
not yet built. See the enforcement map.

---

**Part VIII — Transitional Governance** *(principle 22)*

## 22. No Improvised Governance Before Its Systems Exist

*Adopted 2026-06-13 at the owner's explicit request.*

Bridges will not take discretionary governance actions that claim to follow
constitutional procedures until those procedures actually exist in the
system: active notification (principle 14), attributable reporting and
no-anonymous-accusation (principle 15), evidence, transparent review, and
appeal.

Until those systems are built, Bridges does not improvise a moderation
process and then dress it in constitutional language. What it relies on in
the meantime are **hard technical boundaries that need no discretion** — RLS
denial (principles 1, 3) and Architect refusal (principles 10, 19). Those
continue to operate. Discretionary enforcement waits for its scaffolding;
the absence of that scaffolding is a reason to *not act*, never a license to
act informally. The alpha therefore stays **private/bridged**: Bridges does
not open unrestricted public posting first and improvise governance
afterward.

This restraint is about **sequencing, not suspicion**. Public activity is
not contrary to Bridges. The Constitution anticipates that Islands will one
day host voluntary public and semi-public activity — public posts,
storefronts, selling and buying, offers, social gathering places, dating
spaces, clubs, events, and more — governed by the systems above and by the
principles of Part IX. Those features wait for their governance, not because
the activity is suspect, but because the protections must come first.

`Status:` operational commitment, honored now (no discretionary governance
mechanism exists, and none is improvised) — see the enforcement map.

---

**Part IX — Identity, Intent, and Voluntary Exchange** *(principles 23–26;
the model for the future public and semi-public activity anticipated by
principle 22. These are forward commitments; their dedicated design is
deferred — see the enforcement map's "Future design required.")*

## 23. Self-Declared Identity and Contextual Presentation

*Adopted 2026-06-13 at the owner's explicit request.*

A person decides what others may see about them.

Bridges must not infer and expose a person's interests, needs, relationship
status, commercial intent, employment status, social identity, or other
personal facets from hidden observation. What others learn about a person is
what that person chose to disclose — not what the platform deduced by
watching.

A person may deliberately present **different facets in different contexts** —
different Places, or through different Bridges. The same person may show one
face in a professional space, another in a marketplace, a creative space, a
social space, a dating space, a club, a classroom, or a shared Place such as
a café, park, lounge, gallery, or fair — and they control which facet appears
in each. Examples of what one might choose to disclose in a given context:

- items they want to buy;
- things they are selling;
- services they offer;
- work they seek;
- hobbies and interests;
- openness to collaboration;
- social or dating availability;
- events or communities they want to join.

Presence in one Place must not expose the whole Island. A facet shown in one
context reveals only that facet.

> **You decide what others know about you.**

`Status:` operational commitment now (honored by absence — no inference or
exposure mechanism exists); the affirmative facet model is not yet designed.
See the enforcement map.

## 24. Declared Intent, Not Behavioral Targeting

*Adopted 2026-06-13 at the owner's explicit request.*

Bridges must not predict what people want through surveillance, browsing
history, private conversations, inferred income, behavioral tracking, or
hidden profiling.

Instead, people **say** what they want. A user may explicitly declare what
information, offers, advertisements, jobs, products, events, services, or
introductions they are interested in receiving. Sellers, employers,
organizations, creators, and advertisers may respond **only within the scope
the recipient deliberately opened** — never wider.

Consent here is express and narrow:

- Browsing is not consent.
- Silence is not consent.
- Presence in a Place is not consent to future commercial contact.

> **Do not predict what people want. Let them say what they want.**

`Status:` operational commitment now (honored by absence — no behavioral
targeting, tracking, or prediction exists); the declared-interest mechanism
is not yet designed. See the enforcement map.

## 25. Recipient-Controlled Commercial Communication

*Adopted 2026-06-13 at the owner's explicit request.*

Commercial and promotional communication is controlled by its recipient.

The recipient controls the terms of contact: the categories they will hear
about; who may respond; how many responses; for how long (duration or
expiration); the geographic range; whether businesses, individuals, bots, or
AI representatives may contact them; and whether any follow-up is allowed.

Every commercial communication must clearly identify:

- that it is commercial;
- the seller, sponsor, or organization responsible for it;
- whether the representative is Human, AI, or Bot (principle 12).

A declared interest may not be widened into unrelated marketing. Declared
interests may not be sold, resold, or repurposed into behavioral profiles
(principles 17, 24).

`Status:` not yet designed (no commercial-communication feature exists); the
no-resale / no-widening commitments are honored by absence today. See the
enforcement map.

## 26. Voluntary Offering and Discovery

*Adopted 2026-06-13 at the owner's explicit request.*

Just as people declare what they want (principle 24), they may deliberately
publish what they have, sell, offer, create, teach, provide, or wish to
share.

Public availability must be **explicitly chosen by the owner**. Bridges must
not publish, promote, or expose an offering merely because it exists
privately on an Island (principles 3, 6).

Discovery arises through voluntary search, declared interests, selected
Places, explicit Bridges, and user-controlled public presentation — never
through hidden engagement optimization. The platform connects what people
chose to offer with what people chose to seek; it does not manufacture
attention.

`Status:` not yet designed (no publishing, search, or discovery feature
exists); the no-auto-exposure commitment is honored by absence today. See
the enforcement map.
