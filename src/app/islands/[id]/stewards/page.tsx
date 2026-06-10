import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IslandSilhouette } from "@/components/island-silhouette";
import { PLACE_TYPE_ICONS, type Place } from "@/lib/places";
import {
  MODEL_PROVIDERS,
  STEWARD_ROLES,
  STEWARD_ROLE_ICONS,
  formatRole,
  type Steward,
} from "@/lib/stewards";
import { stewardKnowledge } from "@/lib/steward-knowledge";
import { createSteward, deleteSteward, updateSteward } from "./actions";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";

function StewardFormFields({
  steward,
  places,
}: {
  steward?: Steward;
  places: Pick<Place, "id" | "name" | "type">[];
}) {
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
            defaultValue={steward?.name}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="role" className="block text-sm font-medium">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={steward?.role ?? "librarian"}
            className={inputClass}
          >
            {STEWARD_ROLES.map((role) => (
              <option key={role} value={role}>
                {STEWARD_ROLE_ICONS[role]} {formatRole(role)}
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
          defaultValue={steward?.description ?? ""}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="place_id" className="block text-sm font-medium">
            Assignment
          </label>
          <select
            id="place_id"
            name="place_id"
            defaultValue={steward?.place_id ?? ""}
            className={inputClass}
          >
            <option value="">🏝️ Island-wide</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {PLACE_TYPE_ICONS[place.type] ?? "📍"} {place.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="visibility" className="block text-sm font-medium">
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue={steward?.visibility ?? "private"}
            className={inputClass}
          >
            <option value="private">private</option>
            <option value="bridged">bridged</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="model_provider" className="block text-sm font-medium">
            Model provider{" "}
            <span className="font-normal text-gray-500">(not connected yet)</span>
          </label>
          <select
            id="model_provider"
            name="model_provider"
            defaultValue={steward?.model_provider ?? ""}
            className={inputClass}
          >
            <option value="">None</option>
            {MODEL_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="model_name" className="block text-sm font-medium">
            Model name <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input
            id="model_name"
            name="model_name"
            maxLength={120}
            defaultValue={steward?.model_name ?? ""}
            placeholder="e.g. claude-fable-5"
            className={inputClass}
          />
        </div>
      </div>
    </>
  );
}

export default async function StewardsPage({
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

  // RLS: only the owner and bridged users can see the island at all.
  const { data: island } = await supabase
    .from("islands")
    .select("id, name, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!island) {
    notFound();
  }

  const isOwner = island.owner_id === user.id;

  // Places for the assignment dropdown and for labeling place-scoped
  // stewards. RLS filters this list for bridged users automatically.
  const { data: placeData } = await supabase
    .from("places")
    .select("id, name, type")
    .eq("island_id", island.id)
    .order("created_at", { ascending: true });

  const places = (placeData ?? []) as Pick<Place, "id" | "name" | "type">[];
  const placeById = new Map(places.map((place) => [place.id, place]));

  // Knowledge source: the viewer-visible assets of this island. Fetched with
  // the viewer's session, so RLS has already applied the viewer gate — a
  // bridged visitor's rows are only the bridged-visible ones.
  const { data: assetData } = await supabase
    .from("assets")
    .select("id, title, place_id")
    .eq("island_id", island.id)
    .order("created_at", { ascending: true });

  const assets = (assetData ?? []) as {
    id: string;
    title: string;
    place_id: string;
  }[];

  // RLS: owners get every steward; bridged users only 'bridged' stewards
  // that are island-wide or on a 'bridged' place.
  const { data } = await supabase
    .from("stewards")
    .select(
      "id, island_id, place_id, owner_id, name, role, description, model_provider, model_name, visibility, created_at"
    )
    .eq("island_id", island.id)
    .order("created_at", { ascending: true });

  const stewards = (data ?? []) as Steward[];
  const editingSteward = isOwner
    ? stewards.find((steward) => steward.id === edit)
    : undefined;

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
        <h1 className="text-2xl font-semibold">Stewards</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Caretakers of {island.name}, island-wide or at a specific place.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Steward cards */}
      {stewards.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {stewards.map((steward) => {
            const place = steward.place_id
              ? placeById.get(steward.place_id)
              : undefined;
            const knowledge = stewardKnowledge(steward, places, assets);
            return (
              <li
                key={steward.id}
                className="space-y-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {STEWARD_ROLE_ICONS[steward.role] ?? "🤝"} {steward.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatRole(steward.role)} ·{" "}
                      {steward.place_id
                        ? `at ${place?.name ?? "a place"}`
                        : "island-wide"}{" "}
                      · {steward.visibility}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex shrink-0 gap-2 text-xs">
                      <Link
                        href={`/islands/${island.id}/stewards?edit=${steward.id}`}
                        className="underline"
                      >
                        Edit
                      </Link>
                      <form action={deleteSteward}>
                        <input type="hidden" name="island_id" value={island.id} />
                        <input
                          type="hidden"
                          name="steward_id"
                          value={steward.id}
                        />
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
                {steward.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {steward.description}
                  </p>
                )}
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer">
                    Knows{knowledge.scope === "island" ? " the island," : ""}{" "}
                    {knowledge.places.length}{" "}
                    {knowledge.places.length === 1 ? "place" : "places"} ·{" "}
                    {knowledge.assets.length}{" "}
                    {knowledge.assets.length === 1 ? "asset" : "assets"}
                  </summary>
                  <div className="mt-2 space-y-1">
                    {knowledge.places.length === 0 ? (
                      <p>Nothing in reach yet.</p>
                    ) : (
                      knowledge.places.map((knownPlace) => {
                        const placeAssets = knowledge.assets.filter(
                          (asset) => asset.place_id === knownPlace.id
                        );
                        return (
                          <p key={knownPlace.id}>
                            {PLACE_TYPE_ICONS[knownPlace.type] ?? "📍"}{" "}
                            {knownPlace.name}
                            {placeAssets.length > 0 && (
                              <>
                                {" — "}
                                {placeAssets
                                  .map((asset) => asset.title)
                                  .join(", ")}
                              </>
                            )}
                          </p>
                        );
                      })
                    )}
                  </div>
                </details>
                <p className="text-xs text-gray-500">
                  {steward.model_provider
                    ? `${steward.model_provider}${
                        steward.model_name ? ` · ${steward.model_name}` : ""
                      } (not connected)`
                    : "No model configured"}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isOwner
            ? "No stewards yet. Appoint your first one below."
            : "No stewards have been shared with you on this island."}
        </p>
      )}

      {/* Create / edit form (owner only) */}
      {isOwner && (
        <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              {editingSteward
                ? `Edit "${editingSteward.name}"`
                : "Appoint a steward"}
            </h2>
            {editingSteward && (
              <Link
                href={`/islands/${island.id}/stewards`}
                className="text-sm underline"
              >
                Cancel
              </Link>
            )}
          </div>
          <form
            action={editingSteward ? updateSteward : createSteward}
            className="space-y-4"
          >
            <input type="hidden" name="island_id" value={island.id} />
            {editingSteward && (
              <input type="hidden" name="steward_id" value={editingSteward.id} />
            )}
            <StewardFormFields
              key={editingSteward?.id ?? "new"}
              steward={editingSteward}
              places={places}
            />
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
            >
              {editingSteward ? "Save changes" : "Appoint steward"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
