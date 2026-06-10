import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IslandSilhouette } from "@/components/island-silhouette";
import { ASSET_TYPES, ASSET_TYPE_ICONS, type Asset } from "@/lib/assets";
import { PLACE_TYPE_ICONS, type Place } from "@/lib/places";
import {
  STEWARD_ROLE_ICONS,
  formatRole,
  type Steward,
} from "@/lib/stewards";
import { createAsset, deleteAsset, updateAsset } from "./actions";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";

function AssetFormFields({ asset }: { asset?: Asset }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="title" className="block text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={asset?.title}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="asset_type" className="block text-sm font-medium">
            Type
          </label>
          <select
            id="asset_type"
            name="asset_type"
            defaultValue={asset?.asset_type ?? "note"}
            className={inputClass}
          >
            {ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {ASSET_TYPE_ICONS[type]} {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium">
          Description <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <input
          id="description"
          name="description"
          maxLength={1000}
          defaultValue={asset?.description ?? ""}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="content_text" className="block text-sm font-medium">
          Content <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="content_text"
          name="content_text"
          rows={4}
          maxLength={20000}
          defaultValue={asset?.content_text ?? ""}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="url" className="block text-sm font-medium">
            URL <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input
            id="url"
            name="url"
            type="url"
            maxLength={2048}
            defaultValue={asset?.url ?? ""}
            placeholder="https://"
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
            defaultValue={asset?.visibility ?? "private"}
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

export default async function PlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; placeId: string }>;
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const { id, placeId } = await params;
  const { error, edit } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS: the island is visible to its owner and bridged users only.
  const { data: island } = await supabase
    .from("islands")
    .select("id, name, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!island) {
    notFound();
  }

  // RLS: bridged users only see places with visibility = 'bridged',
  // so a private place 404s for them just like a nonexistent one.
  const { data: placeRow } = await supabase
    .from("places")
    .select(
      "id, island_id, name, type, description, position_x, position_y, visibility, created_at"
    )
    .eq("id", placeId)
    .eq("island_id", island.id)
    .maybeSingle();

  if (!placeRow) {
    notFound();
  }

  const place = placeRow as Place;
  const isOwner = island.owner_id === user.id;

  // RLS: owners get every asset; bridged users only those marked 'bridged'.
  const { data } = await supabase
    .from("assets")
    .select(
      "id, island_id, place_id, owner_id, title, description, asset_type, content_text, url, visibility, created_at, updated_at"
    )
    .eq("place_id", place.id)
    .order("created_at", { ascending: true });

  const assets = (data ?? []) as Asset[];
  const editingAsset = isOwner
    ? assets.find((asset) => asset.id === edit)
    : undefined;

  // Stewards assigned to this place (managed from the island stewards page).
  const { data: stewardData } = await supabase
    .from("stewards")
    .select("id, name, role, description, visibility")
    .eq("place_id", place.id)
    .order("created_at", { ascending: true });

  const stewards = (stewardData ?? []) as Pick<
    Steward,
    "id" | "name" | "role" | "description" | "visibility"
  >[];

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
        <h1 className="text-2xl font-semibold">
          {PLACE_TYPE_ICONS[place.type] ?? "📍"} {place.name}
        </h1>
        <p className="text-xs text-gray-500">
          {place.type} · ({place.position_x}, {place.position_y}) ·{" "}
          {place.visibility}
        </p>
        {place.description && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {place.description}
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Assets */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Assets</h2>
        {assets.length > 0 ? (
          <ul className="space-y-3">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="space-y-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {ASSET_TYPE_ICONS[asset.asset_type] ?? "📦"} {asset.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {asset.asset_type} · {asset.visibility} · updated{" "}
                      {new Date(asset.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex shrink-0 gap-2 text-xs">
                      <Link
                        href={`/islands/${island.id}/places/${place.id}?edit=${asset.id}`}
                        className="underline"
                      >
                        Edit
                      </Link>
                      <form action={deleteAsset}>
                        <input type="hidden" name="island_id" value={island.id} />
                        <input type="hidden" name="place_id" value={place.id} />
                        <input type="hidden" name="asset_id" value={asset.id} />
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
                {asset.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {asset.description}
                  </p>
                )}
                {asset.content_text && (
                  <p className="rounded-md bg-gray-50 p-3 text-sm whitespace-pre-wrap dark:bg-gray-900">
                    {asset.content_text}
                  </p>
                )}
                {asset.url && (
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm text-blue-600 underline dark:text-blue-400"
                  >
                    {asset.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isOwner
              ? "No assets here yet. Add one below."
              : "No shared assets at this place yet."}
          </p>
        )}
      </section>

      {/* Stewards at this place */}
      {stewards.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Stewards here</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {stewards.map((steward) => (
              <li
                key={steward.id}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              >
                <p className="font-medium">
                  {STEWARD_ROLE_ICONS[steward.role] ?? "🤝"} {steward.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatRole(steward.role)} · {steward.visibility}
                </p>
                {steward.description && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {steward.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {isOwner && (
            <p className="text-xs text-gray-500">
              Manage stewards from the{" "}
              <Link
                href={`/islands/${island.id}/stewards`}
                className="underline"
              >
                island stewards page
              </Link>
              .
            </p>
          )}
        </section>
      )}

      {/* Create / edit form (owner only) */}
      {isOwner && (
        <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              {editingAsset ? `Edit "${editingAsset.title}"` : "Add an asset"}
            </h2>
            {editingAsset && (
              <Link
                href={`/islands/${island.id}/places/${place.id}`}
                className="text-sm underline"
              >
                Cancel
              </Link>
            )}
          </div>
          <form
            action={editingAsset ? updateAsset : createAsset}
            className="space-y-4"
          >
            <input type="hidden" name="island_id" value={island.id} />
            <input type="hidden" name="place_id" value={place.id} />
            {editingAsset && (
              <input type="hidden" name="asset_id" value={editingAsset.id} />
            )}
            <AssetFormFields key={editingAsset?.id ?? "new"} asset={editingAsset} />
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
            >
              {editingAsset ? "Save changes" : "Add asset"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
