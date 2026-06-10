import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PLACE_TYPES,
  PLACE_TYPE_ICONS,
  type Place,
} from "@/lib/places";
import {
  createPlace,
  deletePlace,
  grantBridge,
  revokeBridge,
  updatePlace,
} from "./actions";

type BridgeWithEmail = {
  id: string;
  granted_to: string;
  created_at: string;
  email: string;
};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";

function PlaceFormFields({ place }: { place?: Place }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={place?.name}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="type" className="block text-sm font-medium">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={place?.type ?? "landmark"}
            className={inputClass}
          >
            {PLACE_TYPES.map((type) => (
              <option key={type} value={type}>
                {PLACE_TYPE_ICONS[type]} {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium">
          Description <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={1000}
          defaultValue={place?.description ?? ""}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label htmlFor="position_x" className="block text-sm font-medium">
            X (0–100)
          </label>
          <input
            id="position_x"
            name="position_x"
            type="number"
            min={0}
            max={100}
            defaultValue={place?.position_x ?? 50}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="position_y" className="block text-sm font-medium">
            Y (0–100)
          </label>
          <input
            id="position_y"
            name="position_y"
            type="number"
            min={0}
            max={100}
            defaultValue={place?.position_y ?? 50}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="visibility" className="block text-sm font-medium">
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue={place?.visibility ?? "private"}
            className={inputClass}
          >
            <option value="private">private</option>
            <option value="bridged">bridged</option>
          </select>
        </div>
      </div>
    </>
  );
}

export default async function IslandPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const { id } = await params;
  const { error, edit } = await searchParams;
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

  const isOwner = island.owner_id === user.id;

  // RLS already filters: owners get every place, bridged users only
  // see places with visibility = 'bridged'.
  const { data } = await supabase
    .from("places")
    .select(
      "id, island_id, name, type, description, position_x, position_y, visibility, created_at, assets(count)"
    )
    .eq("island_id", island.id)
    .order("created_at", { ascending: true });

  const places = (data ?? []) as (Place & { assets: { count: number }[] })[];
  const editingPlace = isOwner
    ? places.find((place) => place.id === edit)
    : undefined;

  // Owner-only: active bridges for this island, labeled with grantee emails.
  let bridges: BridgeWithEmail[] = [];
  if (isOwner) {
    const { data: bridgeRows } = await supabase
      .from("bridges")
      .select("id, granted_to, created_at")
      .eq("island_id", island.id)
      .order("created_at", { ascending: true });

    const granteeIds = (bridgeRows ?? []).map((bridge) => bridge.granted_to);
    const { data: profileRows } = granteeIds.length
      ? await supabase.from("profiles").select("id, email").in("id", granteeIds)
      : { data: [] };

    const emailById = new Map(
      (profileRows ?? []).map((profile) => [profile.id, profile.email])
    );
    bridges = (bridgeRows ?? []).map((bridge) => ({
      ...bridge,
      email: emailById.get(bridge.granted_to) ?? bridge.granted_to,
    }));
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-gray-600 underline dark:text-gray-400"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{island.name}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isOwner ? "You own this island." : "Shared with you via a bridge."}
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Island map */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Map</h2>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950">
          {places.map((place) => (
            <div
              key={place.id}
              style={{ left: `${place.position_x}%`, top: `${place.position_y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
            >
              <span className="text-xl" title={place.name}>
                {PLACE_TYPE_ICONS[place.type] ?? "📍"}
              </span>
              <p className="max-w-24 truncate text-xs font-medium text-emerald-900 dark:text-emerald-200">
                {place.name}
              </p>
            </div>
          ))}
          {places.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-emerald-700 dark:text-emerald-400">
              No places on this island yet.
            </p>
          )}
        </div>
      </section>

      {/* Place cards */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Places</h2>
        {places.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {places.map((place) => (
              <li
                key={place.id}
                className="space-y-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/islands/${island.id}/places/${place.id}`}
                      className="font-medium hover:underline"
                    >
                      {PLACE_TYPE_ICONS[place.type] ?? "📍"} {place.name}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {place.type} · ({place.position_x}, {place.position_y}) ·{" "}
                      {place.visibility} · {place.assets[0]?.count ?? 0}{" "}
                      {(place.assets[0]?.count ?? 0) === 1 ? "asset" : "assets"}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex shrink-0 gap-2 text-xs">
                      <Link
                        href={`/islands/${island.id}?edit=${place.id}`}
                        className="underline"
                      >
                        Edit
                      </Link>
                      <form action={deletePlace}>
                        <input type="hidden" name="island_id" value={island.id} />
                        <input type="hidden" name="place_id" value={place.id} />
                        <button
                          type="submit"
                          className="text-red-600 underline dark:text-red-400"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  )}
                </div>
                {place.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {place.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isOwner
              ? "Add your first place below."
              : "The owner hasn't shared any places with you yet."}
          </p>
        )}
      </section>

      {/* Create / edit form (owner only) */}
      {isOwner && (
        <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              {editingPlace ? `Edit "${editingPlace.name}"` : "Add a place"}
            </h2>
            {editingPlace && (
              <Link href={`/islands/${island.id}`} className="text-sm underline">
                Cancel
              </Link>
            )}
          </div>
          <form
            action={editingPlace ? updatePlace : createPlace}
            className="space-y-4"
          >
            <input type="hidden" name="island_id" value={island.id} />
            {editingPlace && (
              <input type="hidden" name="place_id" value={editingPlace.id} />
            )}
            <PlaceFormFields key={editingPlace?.id ?? "new"} place={editingPlace} />
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
            >
              {editingPlace ? "Save changes" : "Add place"}
            </button>
          </form>
        </section>
      )}

      {/* Bridges management (owner only) */}
      {isOwner && (
        <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-medium">Bridges</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bridged users can view this island and any place marked{" "}
              <span className="font-medium">bridged</span>.
            </p>
          </div>

          {bridges.length > 0 ? (
            <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              {bridges.map((bridge) => (
                <li
                  key={bridge.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{bridge.email}</p>
                    <p className="text-xs text-gray-500">
                      since {new Date(bridge.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <form action={revokeBridge}>
                    <input type="hidden" name="island_id" value={island.id} />
                    <input type="hidden" name="bridge_id" value={bridge.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 underline dark:text-red-400"
                    >
                      Revoke
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No bridges yet. This island is fully private.
            </p>
          )}

          <form action={grantBridge} className="flex gap-2">
            <input type="hidden" name="island_id" value={island.id} />
            <input
              name="email"
              type="email"
              required
              placeholder="user@example.com"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
            >
              Grant bridge
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
