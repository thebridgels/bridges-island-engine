# Bridges Island Engine

Next.js (App Router) + Supabase MVP. Users own private **islands**; a **bridge**
is an explicit grant that shares an island with another user. Auth is Supabase
email + password only (no OAuth, no magic links).

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Configure env vars.** Copy `.env.example` to `.env.local` and fill in the
   values from *Dashboard → Project Settings → API*:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```

3. **Apply the database migration.** Either paste
   [supabase/migrations/20260610000000_islands_and_bridges.sql](supabase/migrations/20260610000000_islands_and_bridges.sql)
   into the Supabase SQL Editor and run it, or use the CLI:

   ```
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. **(Recommended for dev) Disable email confirmation** so signup logs you in
   immediately: *Dashboard → Authentication → Sign In / Providers → Email →
   turn off "Confirm email"*. The app handles both modes — with confirmation
   on, signup redirects to login with a "check your email" notice.

5. **Run the app:**

   ```
   npm run dev
   ```

## Auth model

- Sign up / log in with email + password (`/signup`, `/login`); log out from
  the dashboard.
- [src/proxy.ts](src/proxy.ts) refreshes the Supabase session on every request
  and redirects unauthenticated users away from `/dashboard` and `/islands/*`.
  Pages also re-check the user server-side as defense in depth.
- Every island row has `owner_id → auth.users.id`.

## Row Level Security

Defined in [the migration](supabase/migrations/20260610000000_islands_and_bridges.sql):

- **islands** — owners have full access; other users can *read* an island only
  if a bridge grants them access. Inserts must set `owner_id` to the caller.
- **bridges** — only the island owner can create them; the owner can revoke
  and the grantee can remove their own access.
- Policies use `security definer` helper functions (`has_bridge_access`,
  `is_island_owner`) to avoid recursive RLS between the two tables.

All data access goes through the user's session (anon key + RLS); there is no
service-role key in the app.
