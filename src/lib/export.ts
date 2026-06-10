// Owner Export: a snapshot of an island, assembled entirely through the
// requesting owner's Supabase session.
//
// Ownership made concrete: everything in the export is data the owner
// already sees in the app, fetched with the same RLS-enforced session the
// app uses for every page. There is no service-role client, no admin
// client, and no RLS bypass anywhere in this module — if RLS would hide a
// row from the caller, it is not in the export.
//
// Scope: island, places, assets (with provenance fields), architects (with
// derived knowledge summaries), bridge metadata (grantee emails come from
// the existing owner-visible profiles relationship), and the audit ledger.
// Never included: auth secrets, session data, API keys, or environment
// variables — the export is built from table rows only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Architect } from "./architects";
import type { Asset } from "./assets";
import type { Place } from "./places";
import type { AuditEvent } from "./audit";
import { architectKnowledge } from "./architect-knowledge";

export const EXPORT_VERSION = 1;

type ExportArchitect = Architect & {
  knowledge_summary: {
    scope: "island" | "place";
    place_ids: string[];
    asset_ids: string[];
    description: string;
  };
};

type ExportBridge = {
  id: string;
  granted_to_email: string;
  created_at: string;
};

export type IslandExport = {
  export_version: number;
  exported_at: string;
  island: {
    id: string;
    name: string;
    created_at: string;
  };
  places: Place[];
  assets: Asset[];
  architects: ExportArchitect[];
  bridges: ExportBridge[];
  audit_events: AuditEvent[];
  notes: {
    ownership: string;
    security: string;
    snapshot: string;
  };
};

// Builds the export for an island the caller owns. The caller's ownership
// must already be verified by the route (404 otherwise), but every query
// below still runs through the caller's session — RLS, not the route
// check, is what keeps other people's rows out.
export async function buildIslandExport(
  supabase: SupabaseClient,
  island: { id: string; name: string; created_at: string }
): Promise<IslandExport> {
  const [placeRes, assetRes, architectRes, bridgeRes, auditRes] =
    await Promise.all([
      supabase
        .from("places")
        .select(
          "id, island_id, name, type, description, position_x, position_y, visibility, created_at"
        )
        .eq("island_id", island.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("assets")
        .select(
          "id, island_id, place_id, owner_id, title, description, asset_type, content_text, url, visibility, source_type, created_by_ai, source_note, created_at, updated_at"
        )
        .eq("island_id", island.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("architects")
        .select(
          "id, island_id, place_id, owner_id, name, role, description, model_provider, model_name, visibility, created_at"
        )
        .eq("island_id", island.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("bridges")
        .select("id, granted_to, created_at")
        .eq("island_id", island.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("audit_events")
        .select(
          "id, island_id, actor_id, action, target_type, target_id, metadata, created_at"
        )
        .eq("island_id", island.id)
        .order("created_at", { ascending: true }),
    ]);

  const places = (placeRes.data ?? []) as Place[];
  const assets = (assetRes.data ?? []) as Asset[];
  const architects = (architectRes.data ?? []) as Architect[];
  const bridgeRows = (bridgeRes.data ?? []) as {
    id: string;
    granted_to: string;
    created_at: string;
  }[];
  const auditEvents = (auditRes.data ?? []) as AuditEvent[];

  // Grantee emails through the existing owner-visible relationship: RLS
  // lets island owners read the profiles of users bridged to their
  // islands — the same path that labels the bridges list in the UI.
  const granteeIds = bridgeRows.map((bridge) => bridge.granted_to);
  const { data: profileRows } = granteeIds.length
    ? await supabase.from("profiles").select("id, email").in("id", granteeIds)
    : { data: [] };
  const emailById = new Map(
    (profileRows ?? []).map((profile) => [profile.id, profile.email])
  );

  const bridges: ExportBridge[] = bridgeRows.map((bridge) => ({
    id: bridge.id,
    granted_to_email: emailById.get(bridge.granted_to) ?? bridge.granted_to,
    created_at: bridge.created_at,
  }));

  const placeNameById = new Map(places.map((place) => [place.id, place.name]));

  const exportArchitects: ExportArchitect[] = architects.map((architect) => {
    const knowledge = architectKnowledge(architect, places, assets);
    return {
      ...architect,
      knowledge_summary: {
        scope: knowledge.scope,
        place_ids: knowledge.places.map((place) => place.id),
        asset_ids: knowledge.assets.map((asset) => asset.id),
        description:
          knowledge.scope === "island"
            ? `Knows the island: ${knowledge.places.length} place(s), ${knowledge.assets.length} asset(s).`
            : `Knows ${
                architect.place_id
                  ? placeNameById.get(architect.place_id) ?? "its place"
                  : "its place"
              }: ${knowledge.assets.length} asset(s).`,
      },
    };
  });

  return {
    export_version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    island: {
      id: island.id,
      name: island.name,
      created_at: island.created_at,
    },
    places,
    assets,
    architects: exportArchitects,
    bridges,
    audit_events: auditEvents,
    notes: {
      ownership:
        "This export was generated by the Island owner through their own session.",
      security: "No service-role access was used.",
      snapshot:
        "This is a point-in-time snapshot of the island, not a live backup.",
    },
  };
}
