-- Profiles + email-based bridge granting.
--
-- The auth schema is not queryable from the client API, so granting a bridge
-- by email needs a public mirror of (user id, email):
--   * public.profiles is kept in sync with auth.users by a trigger.
--   * Profiles are NOT broadly readable. A security definer function performs
--     exact-match email -> user id lookup, so one user cannot enumerate
--     other users' email addresses; island owners can additionally read the
--     profiles of users bridged to their islands (to label the bridges list).

-- ---------------------------------------------------------------------------
-- Profiles table, synced from auth.users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null then
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_change
after insert or update of email on auth.users
for each row execute function public.handle_auth_user_change();

-- Backfill users that signed up before this migration.
insert into public.profiles (id, email)
select id, email from auth.users
where email is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Email -> user id lookup (exact match only, no enumeration)
-- ---------------------------------------------------------------------------

create or replace function public.lookup_user_id_by_email(lookup_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where lower(p.email) = lower(trim(lookup_email))
  limit 1;
$$;

revoke execute on function public.lookup_user_id_by_email(text) from public, anon;
grant execute on function public.lookup_user_id_by_email(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

-- Owners see the profiles of users bridged to their islands, so the
-- bridges list can show emails instead of raw user ids.
create policy "Island owners can view bridged users' profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.bridges b
    where b.granted_to = profiles.id
      and public.is_island_owner(b.island_id)
  )
);

-- No insert/update/delete policies: profiles are only written by the
-- security definer trigger, never directly by clients.
