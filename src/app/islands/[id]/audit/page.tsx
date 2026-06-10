import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IslandSilhouette } from "@/components/island-silhouette";
import { AUDIT_ACTION_LABELS, type AuditEvent } from "@/lib/audit";

const TARGET_ICONS: Record<string, string> = {
  place: "📍",
  asset: "📦",
  steward: "🤝",
  bridge: "🌉",
};

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: island } = await supabase
    .from("islands")
    .select("id, name, owner_id")
    .eq("id", id)
    .maybeSingle();

  // The ledger is for owners only. For everyone else — including bridged
  // visitors — this page does not exist. RLS would return zero events
  // anyway; the 404 keeps the page itself from acknowledging them.
  if (!island || island.owner_id !== user.id) {
    notFound();
  }

  const { data } = await supabase
    .from("audit_events")
    .select(
      "id, island_id, actor_id, action, target_type, target_id, metadata, created_at"
    )
    .eq("island_id", island.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const events = (data ?? []) as AuditEvent[];

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="animate-arrive relative h-24 overflow-hidden rounded-xl">
        <IslandSilhouette
          islandId={island.id}
          className="absolute inset-0 h-full w-full"
        />
        <Link
          href={`/islands/${island.id}`}
          className="absolute left-4 top-3 text-sm font-medium text-white underline [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]"
        >
          ← {island.name}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">📜 Ledger</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Everything that has changed on {island.name}, and who changed it.
          Only you can read this.
        </p>
      </div>

      {events.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {events.map((event) => {
            const label =
              AUDIT_ACTION_LABELS[event.action] ?? event.action;
            const displayName =
              event.metadata.name ?? event.metadata.title ?? null;
            return (
              <li key={event.id} className="px-4 py-3">
                <p className="text-sm">
                  {TARGET_ICONS[event.target_type] ?? "·"}{" "}
                  <span className="font-medium">
                    {event.actor_id === user.id ? "You" : "Someone"}
                  </span>{" "}
                  {label}
                  {displayName && (
                    <>
                      {": "}
                      <span className="font-medium">{displayName}</span>
                    </>
                  )}
                  {event.metadata.source_type && (
                    <span className="text-gray-500">
                      {" "}
                      ({event.metadata.source_type})
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(event.created_at).toLocaleString()}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Nothing recorded yet. The ledger begins with your next change.
        </p>
      )}

      <p className="text-xs text-gray-500">
        The ledger is append-only and shows the most recent 100 events.
      </p>
    </main>
  );
}
