import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function IslandPage({
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

  // RLS hides islands the user doesn't own or have a bridge to,
  // so an unauthorized id behaves exactly like a nonexistent one.
  const { data: island } = await supabase
    .from("islands")
    .select("id, name, owner_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!island) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <Link
        href="/dashboard"
        className="text-sm text-gray-600 underline dark:text-gray-400"
      >
        ← Back to dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{island.name}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {island.owner_id === user.id
            ? "You own this island."
            : "Shared with you via a bridge."}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Created {new Date(island.created_at).toLocaleString()}
        </p>
      </div>
    </main>
  );
}
