import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IslandSilhouette } from "@/components/island-silhouette";
import { PLACE_TYPES, PLACE_TYPE_ICONS, type Place } from "@/lib/places";
import {
  ARCHITECT_ROLE_ICONS,
  type Architect,
} from "@/lib/architects";
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

  // Architects present on the island (RLS-filtered for bridged visitors).
  const { data: architectData } = await supabase
    .from("architects")
    .select("id, name, role, place_id")
    .eq("island_id", island.id)
    .order("created_at", { ascending: true });

  const architects = (architectData ?? []) as Pick<
    Architect,
    "id" | "name" | "role" | "place_id"
  >[];
  const shoreArchitects = architects.filter((architect) => !architect.place_id);

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
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <div className="flex items-center justify-between text-sm">
        <Link
          href="/dashboard"
          className="text-gray-600 underline dark:text-gray-400"
        >
          ← The sea
        </Link>
        <span className="flex gap-4">
          <Link
            href={`/islands/${island.id}/architects`}
            className="text-gray-600 underline dark:text-gray-400"
          >
            📐 Architects ({architects.length})
          </Link>
          {isOwner && (
            <Link
              href={`/islands/${island.id}/audit`}
              className="text-gray-600 underline dark:text-gray-400"
            >
              📜 Ledger
            </Link>
          )}
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {/* The island. Not a panel on the page — the page. */}
      <section className="animate-arrive relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
        <IslandSilhouette
          islandId={island.id}
          className="absolute inset-0 h-full w-full"
        />

        <div className="absolute left-5 top-4">
          <h1 className="text-3xl font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
            {island.name}
          </h1>
          <p className="text-sm text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
            {isOwner
              ? "You are home."
              : "You've crossed a bridge to someone's shore."}
          </p>
        </div>

        {places.map((place) => (
          <Link
            key={place.id}
            href={`/islands/${island.id}/places/${place.id}`}
            style={{
              left: `${10 + place.position_x * 0.8}%`,
              top: `${10 + place.position_y * 0.8}%`,
            }}
            className="group absolute -translate-x-1/2 -translate-y-1/2 text-center"
          >
            <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg ring-1 ring-black/15 transition-transform group-hover:scale-110 dark:bg-gray-900/90">
              {PLACE_TYPE_ICONS[place.type] ?? "📍"}
            </span>
            <span className="mt-1 block max-w-28 truncate rounded-full bg-black/45 px-2 py-0.5 text-xs font-medium text-white">
              {place.name}
            </span>
          </Link>
        ))}

        {places.length === 0 && (
          <p className="absolute inset-x-0 bottom-12 text-center text-sm text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
            {isOwner
              ? "Unbroken ground. Build your first place."
              : "Nothing here has been shared with you yet."}
          </p>
        )}

        {shoreArchitects.length > 0 && (
          <div className="absolute bottom-3 left-3 flex max-w-[80%] flex-wrap gap-1.5">
            {shoreArchitects.map((architect) => (
              <span
                key={architect.id}
                title={architect.name}
                className="rounded-full bg-black/45 px-2 py-0.5 text-xs text-white"
              >
                {ARCHITECT_ROLE_ICONS[architect.role] ?? "📐"} {architect.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Places, told as parts of the island rather than rows of data */}
      {places.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Places</h2>
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
                      {place.type} · {place.assets[0]?.count ?? 0}{" "}
                      {(place.assets[0]?.count ?? 0) === 1 ? "asset" : "assets"}
                      {isOwner && <> · {place.visibility}</>}
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
        </section>
      )}

      {/* The owner's workbench, folded away so the island stays the subject */}
      {isOwner && (
        <details
          open={Boolean(editingPlace) || Boolean(error)}
          className="rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            {editingPlace ? `Editing "${editingPlace.name}"` : "Build a place"}
          </summary>
          <div className="space-y-4 border-t border-gray-200 p-4 dark:border-gray-800">
            {editingPlace && (
              <Link
                href={`/islands/${island.id}`}
                className="text-sm underline"
              >
                Cancel editing
              </Link>
            )}
            <form
              action={editingPlace ? updatePlace : createPlace}
              className="space-y-4"
            >
              <input type="hidden" name="island_id" value={island.id} />
              {editingPlace && (
                <input type="hidden" name="place_id" value={editingPlace.id} />
              )}
              <PlaceFormFields
                key={editingPlace?.id ?? "new"}
                place={editingPlace}
              />
              <button
                type="submit"
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
              >
                {editingPlace ? "Save changes" : "Build place"}
              </button>
            </form>
          </div>
        </details>
      )}

      {isOwner && (
        <details
          open={Boolean(error)}
          className="rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Bridges ({bridges.length})
          </summary>
          <div className="space-y-3 border-t border-gray-200 p-4 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bridged visitors can walk your island and see anything marked{" "}
              <span className="font-medium">bridged</span>.
            </p>

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
                No bridges yet. Your island keeps its own company.
              </p>
            )}

            <form action={grantBridge} className="flex gap-2">
              <input type="hidden" name="island_id" value={island.id} />
              <input
                name="email"
                type="email"
                required
                placeholder="friend@example.com"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              <button
                type="submit"
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
              >
                Raise a bridge
              </button>
            </form>
          </div>
        </details>
      )}
    </main>
  );
}
