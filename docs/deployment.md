# Production Deployment Runbook

Target: deploy the verified MVP to Vercel at **chooseyourbridges.com**,
without feature changes and without touching the constitutional model.
The database is the existing Supabase project (`bridges-mvp`); deployments
build and serve app code only — they never run migrations and never
connect to Postgres outside the user-session model.

No values or secrets appear in this document. Environment variable
*names* only; values live in Vercel's environment settings and local
`.env.local`, both outside git.

## Alpha decisions (current, deliberate)

- **Retain the Saltwind fixture through smoke testing.** The test island
  and `bridges.test.*` accounts stay in the database until production
  smoke tests pass; clean up afterwards if desired (deleting the test
  users in Supabase → Authentication → Users cascades away everything
  they own).
- **Email confirmation stays OFF for the initial alpha.** The app handles
  both modes; Supabase's built-in mailer is rate-limited to a handful of
  emails per hour, so turning confirmation on for real traffic requires
  custom SMTP first. Revisit together.
- **No Preview environment variables yet.** Preview deployments would hit
  the same production database; leaving their env unset keeps preview
  URLs inert until a deliberate preview policy exists.

## 1. Vercel project setup

1. Sign in at vercel.com with the `thebridgels` GitHub account.
2. Add New → Project → import the private repo
   `thebridgels/bridges-island-engine` (authorize the Vercel GitHub App).
3. Framework preset: Next.js (auto-detected). Keep default build command
   (`next build`), install command, and root directory. No `vercel.json`.
4. Enter the environment variables (next section) **before** the first
   deploy, then Deploy.

## 2. Environment variables (Production scope)

Exactly four, no more — in particular, **no service-role key exists and
none may ever be added** (constitution, principle 1):

| Name | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | public by design; RLS is the boundary |
| `ANTHROPIC_API_KEY` | **server-only** | mark Sensitive; never `NEXT_PUBLIC_`-prefixed; grants zero database rows |
| `ANTHROPIC_DEFAULT_MODEL` | server-only | optional; explicit beats implicit |

Set for the **Production** environment only (see alpha decisions: Preview
stays unset).

## 3. Custom domain + DNS

In Vercel → Project → Settings → Domains:

1. Add `chooseyourbridges.com` and `www.chooseyourbridges.com`.
2. Set the apex (`chooseyourbridges.com`) as **primary**; Vercel then
   308-redirects www → apex automatically.

At the domain registrar's DNS panel:

| Type | Host | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

Remove any conflicting `A`/`AAAA`/`CNAME` records on `@` or `www`
(registrar parking records are the usual conflict). Vercel verifies DNS
and issues TLS certificates automatically; propagation is minutes to
about an hour.

## 4. Supabase Auth URL configuration

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://chooseyourbridges.com`
- **Redirect URLs**: add
  - `https://chooseyourbridges.com/**`
  - `https://www.chooseyourbridges.com/**`
  - keep `http://localhost:3000/**` for local development.

With email+password only and confirmation off, nothing currently depends
on these — but they must already be correct the moment email confirmation
is enabled.

## 5. Production security checks

- [ ] Vercel env list contains exactly the four variables above;
      `ANTHROPIC_API_KEY` is marked Sensitive and has no `NEXT_PUBLIC_`
      prefix.
- [ ] No service-role key in Vercel, the repo, or git history (history
      was scanned by value before the first push).
- [ ] Database policies and migrations untouched — deploys never run
      migrations or open non-session database connections.
- [ ] After deploy: view source / bundle search on the production site
      for `sk-ant` — must be absent. (The anon key *will* appear in the
      client bundle; that is correct and by design.)
- [ ] Preview env vars unset (alpha decision) or Deployment Protection
      enabled, so preview URLs cannot reach the production database
      unaudited.

## 6. Known risk: Architect Chat function duration

The longest observed architect reply took **~33 seconds** of server time
locally. Vercel caps function duration by plan and compute mode, and a
low cap would surface as a 504/timeout on send.

**Observe first; change only if production testing demonstrates a
timeout.** If — and only if — the smoke test's chat step times out, the
fix is a one-line `maxDuration` export on the chat route, proposed as its
own reviewed change. Do not add it preemptively.

## 7. Production smoke test

Run against `https://chooseyourbridges.com` with the existing test
accounts (mirrors [manual-test-plan.md](manual-test-plan.md)):

- [ ] **Auth**: OWNER logs in → "Your waters" with Saltwind; logged-out
      `/dashboard` redirects to `/login`.
- [ ] **Owner content**: island map renders with places; assets and
      architects pages load; Ledger loads.
- [ ] **Export**: JSON downloads from `/islands/<id>/export`; structure
      intact (places, assets with provenance, architects with knowledge
      summaries, audit events, notes); `export.island` appears in the
      Ledger; file contains no `sk-ant` / token / secret matches.
- [ ] **Architect Chat**: OWNER sends one message; reply arrives badged
      "Harbormaster · AI"; reply survives a page reload;
      `architect.replied` appears in the Ledger with name-only metadata.
      *(This step doubles as the duration-risk probe — see section 6.)*
- [ ] **Visitor** (grant a bridge for the test, revoke after): sees only
      bridged content and no owner controls; `/export`,
      `/export/download`, chat URL, and `/audit` all → 404.
- [ ] **Stranger**: dashboard shows open water; island URL → 404.
- [ ] **www redirect**: `https://www.chooseyourbridges.com` 308-redirects
      to the apex with a valid certificate.
- [ ] **Revoke closure**: after revoking the test bridge, the visitor
      loses the island entirely (dashboard + direct URL).

## 8. Rollback procedure

- **Bad deployment**: Vercel → Deployments → previous good deployment →
  Instant Rollback (seconds; domain and DNS untouched).
- **Bad first deployment**: Settings → Domains → remove the domain
  assignments while fixing; DNS records can stay in place.
- **Database**: never at risk from a deploy — app code only; no
  migrations run, no data written by the deployment itself. Local
  development against the same Supabase project continues working
  throughout.
- **Nuclear**: delete the Vercel project; GitHub, Supabase, and local
  environments are unaffected.
