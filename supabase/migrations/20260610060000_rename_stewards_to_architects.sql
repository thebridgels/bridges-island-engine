-- Concept rename: Stewards -> Architects.
--
-- An Architect is the persistent AI presence that helps an owner design,
-- build, organize, govern, protect, and present an Island or Place.
--   * The Architect is not the owner.
--   * The Architect has no authority above the owner.
--   * The Architect operates only within the permissions granted by the
--     owner and enforced by the Island.
--
-- Pure rename: table, indexes, policies, constraint names, and the audit
-- vocabulary. No behavior or RLS-semantics change — policies and their
-- expressions carry over with the table rename untouched.
--
-- Ledger note: existing audit_events rows are rewritten from 'steward.*'
-- to 'architect.*' (same events, renamed vocabulary) so the ledger reads
-- consistently in the new language. This is a one-time schema migration,
-- not an API write — the ledger stays append-only from the client's view.

alter table public.stewards rename to architects;

alter index public.stewards_island_id_idx rename to architects_island_id_idx;
alter index public.stewards_place_id_idx rename to architects_place_id_idx;

-- Auto-generated constraint names (stewards_pkey, stewards_role_check, …)
-- keep their old prefix after a table rename; sweep them to architects_*.
do $$
declare
  con record;
begin
  for con in
    select conname
    from pg_constraint
    where conrelid = 'public.architects'::regclass
      and conname like 'stewards%'
  loop
    execute format(
      'alter table public.architects rename constraint %I to %I',
      con.conname,
      'architects' || substring(con.conname from length('stewards') + 1)
    );
  end loop;
end $$;

alter policy "Owners and allowed bridged users can view stewards"
  on public.architects rename to "Owners and allowed bridged users can view architects";
alter policy "Island owners can create stewards"
  on public.architects rename to "Island owners can create architects";
alter policy "Island owners can update stewards"
  on public.architects rename to "Island owners can update architects";
alter policy "Island owners can delete stewards"
  on public.architects rename to "Island owners can delete architects";

-- Audit vocabulary: steward.* -> architect.*
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events drop constraint audit_events_target_type_check;

update public.audit_events
set action = replace(action, 'steward.', 'architect.')
where action like 'steward.%';

update public.audit_events
set target_type = 'architect'
where target_type = 'steward';

alter table public.audit_events add constraint audit_events_action_check
  check (action in (
    'place.created', 'place.updated', 'place.deleted',
    'asset.created', 'asset.updated', 'asset.deleted',
    'architect.created', 'architect.updated', 'architect.deleted',
    'bridge.granted', 'bridge.revoked'
  ));

alter table public.audit_events add constraint audit_events_target_type_check
  check (target_type in ('place', 'asset', 'architect', 'bridge'));
