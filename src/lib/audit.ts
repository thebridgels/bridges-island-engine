import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "place.created"
  | "place.updated"
  | "place.deleted"
  | "asset.created"
  | "asset.updated"
  | "asset.deleted"
  | "architect.created"
  | "architect.updated"
  | "architect.deleted"
  | "architect.replied"
  | "bridge.granted"
  | "bridge.revoked"
  | "export.island";

export type AuditTargetType =
  | "place"
  | "asset"
  | "architect"
  | "bridge"
  | "island";

export type AuditEvent = {
  id: string;
  island_id: string;
  actor_id: string;
  action: AuditAction;
  target_type: AuditTargetType;
  target_id: string;
  metadata: Record<string, string>;
  created_at: string;
};

// Ledger display language, consistent with the island voice.
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "place.created": "built a place",
  "place.updated": "reshaped a place",
  "place.deleted": "removed a place",
  "asset.created": "added an asset",
  "asset.updated": "changed an asset",
  "asset.deleted": "removed an asset",
  "architect.created": "appointed an architect",
  "architect.updated": "reassigned an architect",
  "architect.deleted": "dismissed an architect",
  "architect.replied": "conferred with an architect",
  "bridge.granted": "raised a bridge",
  "bridge.revoked": "withdrew a bridge",
  "export.island": "exported the island",
};

// Best-effort, append-only logging. Failures are swallowed on purpose:
// the ledger must never break the action it describes. RLS only accepts
// rows where the actor is the caller and owns the island, so a non-owner
// path (e.g. a grantee removing their own bridge) is silently skipped.
//
// Keep metadata minimal and non-sensitive: display names only - never
// content, never emails.
export async function logAuditEvent(
  supabase: SupabaseClient,
  event: {
    islandId: string;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId: string;
    metadata?: Record<string, string>;
  }
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("audit_events").insert({
    island_id: event.islandId,
    actor_id: user.id,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId,
    metadata: event.metadata ?? {},
  });
}
