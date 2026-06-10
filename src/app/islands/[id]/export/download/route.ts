import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit";
import { buildIslandExport, EXPORT_VERSION } from "@/lib/export";

// Owner-only JSON download. Everything is fetched through the caller's
// session client (anon key + user cookies): RLS is the boundary, the
// explicit owner check below only decides between content and 404.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  const { data: island } = await supabase
    .from("islands")
    .select("id, name, owner_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!island || island.owner_id !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  const islandExport = await buildIslandExport(supabase, island);

  // Recorded like any other owner action — as the owner, via RLS.
  await logAuditEvent(supabase, {
    islandId: island.id,
    action: "export.island",
    targetType: "island",
    targetId: island.id,
    metadata: { export_version: String(EXPORT_VERSION) },
  });

  const safeName = island.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `island-${safeName || island.id}-${
    new Date().toISOString().slice(0, 10)
  }.json`;

  return new Response(JSON.stringify(islandExport, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
