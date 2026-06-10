import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IslandSilhouette } from "@/components/island-silhouette";

export default async function ExportPage({
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

  // Export is for owners only. For everyone else — including bridged
  // visitors — this page does not exist. RLS would limit the data anyway;
  // the 404 keeps the page itself from acknowledging them.
  if (!island || island.owner_id !== user.id) {
    notFound();
  }

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
        <h1 className="text-2xl font-semibold">⬇️ Export</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Take {island.name} with you. The island is yours; so is its data.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
        <p>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            This export belongs to you.
          </span>{" "}
          It is generated through your own session, with the same permissions
          you have in the app — nothing more, nothing less.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            It includes the island&apos;s structure and content: places,
            assets (with provenance), architects and their knowledge
            summaries, bridge records, and the full audit ledger.
          </li>
          <li>
            It does <span className="font-medium">not</span> include platform
            secrets: no API keys, no session data, no credentials of any
            kind.
          </li>
          <li>
            It is a snapshot of this moment, not a live backup. Export again
            any time the island changes.
          </li>
        </ul>
        <p>Each export is recorded in your island&apos;s ledger.</p>
      </section>

      <a
        href={`/islands/${island.id}/export/download`}
        download={`island-${island.id}.json`}
        className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
      >
        Export Island
      </a>
    </main>
  );
}
