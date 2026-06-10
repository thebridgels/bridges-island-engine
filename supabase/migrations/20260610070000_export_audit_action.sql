-- Owner Export: extend the audit vocabulary with 'export.island'.
--
-- Exporting is part of Island ownership: the owner can take a snapshot of
-- their island's structure and content at any time. The export runs through
-- the owner's own session (RLS enforced, no service-role access), and each
-- export is recorded in the island's ledger like any other owner action.
--
-- Schema change only: widens the audit_events CHECK constraints to accept
-- the new action and an 'island' target type. No table data is touched.

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events drop constraint audit_events_target_type_check;

alter table public.audit_events add constraint audit_events_action_check
  check (action in (
    'place.created', 'place.updated', 'place.deleted',
    'asset.created', 'asset.updated', 'asset.deleted',
    'architect.created', 'architect.updated', 'architect.deleted',
    'bridge.granted', 'bridge.revoked',
    'export.island'
  ));

alter table public.audit_events add constraint audit_events_target_type_check
  check (target_type in ('place', 'asset', 'architect', 'bridge', 'island'));
