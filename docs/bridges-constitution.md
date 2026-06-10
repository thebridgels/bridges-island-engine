# The Bridges Constitution

Principles that govern how Bridges is built. Code, schema, and features may
change freely; these may not be violated by any of them. New principles are
added by the owner of this project, not inferred.

## 1. No God-Mode Access

Normal access to an Island must occur through the identity and permissions
of the person or agent requesting access.

Bridges must not use unrestricted administrative access for ordinary
user-facing reads, writes, steward knowledge, bridge visibility, or model
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
  assets, stewards, bridges, profiles, and the audit ledger are each
  protected at the database layer, so a bug in application code cannot
  widen access.
- Steward knowledge is derived through the viewer's session
  ([steward-knowledge.md](steward-knowledge.md)), and audit logging records
  the requesting user's identity through their own session
  ([provenance.md](provenance.md)). When model context assembly arrives, it
  inherits this rule: context is built exclusively from what the requesting
  identity may see.
