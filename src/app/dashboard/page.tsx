import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";
import { createIsland } from "./actions";

type Island = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  places: { count: number }[];
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS returns islands the user owns plus islands shared with them via a bridge.
  const { data: islands, error: fetchError } = await supabase
    .from("islands")
    .select("id, name, owner_id, created_at, places(count)")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your islands</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Log out
          </button>
        </form>
      </header>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <form action={createIsland} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="New island name"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Create
        </button>
      </form>

      {fetchError ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Could not load islands: {fetchError.message}
        </p>
      ) : islands && islands.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {(islands as Island[]).map((island) => (
            <li key={island.id}>
              <Link
                href={`/islands/${island.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <span className="font-medium">{island.name}</span>
                <span className="text-xs text-gray-500">
                  {island.places[0]?.count ?? 0}{" "}
                  {(island.places[0]?.count ?? 0) === 1 ? "place" : "places"} ·{" "}
                  {island.owner_id === user.id ? "yours" : "shared with you"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No islands yet. Create your first one above.
        </p>
      )}
    </main>
  );
}
