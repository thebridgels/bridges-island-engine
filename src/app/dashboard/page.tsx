import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IslandSilhouette } from "@/components/island-silhouette";
import { logout } from "../(auth)/actions";
import { createIsland } from "./actions";

type Island = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  places: { count: number }[];
};

function IslandCard({ island }: { island: Island }) {
  const placeCount = island.places[0]?.count ?? 0;
  return (
    <li>
      <Link
        href={`/islands/${island.id}`}
        className="group block overflow-hidden rounded-xl border border-gray-200 transition-shadow hover:shadow-md dark:border-gray-800"
      >
        <div className="relative h-32 w-full">
          <IslandSilhouette
            islandId={island.id}
            className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="px-4 py-3">
          <p className="font-medium">{island.name}</p>
          <p className="text-xs text-gray-500">
            {placeCount} {placeCount === 1 ? "place" : "places"}
          </p>
        </div>
      </Link>
    </li>
  );
}

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
  const { data, error: fetchError } = await supabase
    .from("islands")
    .select("id, name, owner_id, created_at, places(count)")
    .order("created_at", { ascending: false });

  const islands = (data ?? []) as Island[];
  const ownIslands = islands.filter((island) => island.owner_id === user.id);
  const bridgedIslands = islands.filter((island) => island.owner_id !== user.id);

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your waters</h1>
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

      {fetchError ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Could not reach your islands: {fetchError.message}
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Your islands</h2>
            {ownIslands.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {ownIslands.map((island) => (
                  <IslandCard key={island.id} island={island} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Open water, as far as you can see. Raise your first island below.
              </p>
            )}
          </section>

          {bridgedIslands.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-medium">Across the bridges</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {bridgedIslands.map((island) => (
                  <IslandCard key={island.id} island={island} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <form action={createIsland} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="Name a new island"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Raise island
        </button>
      </form>
    </main>
  );
}
