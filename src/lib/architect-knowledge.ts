// Architect Knowledge (MVP definition)
//
// Architects do not own knowledge. They are permissioned interfaces to island
// assets. An architect's knowledge is DERIVED at read time from the island,
// places, and assets it has permission to access — there is no knowledge
// table and no copied content.
//
//   * Island architect (place_id null): island-level information plus all
//     owner-visible places and assets (until restrictions exist).
//   * Place architect: only its assigned place and the assets within it.
//
// The viewer's layer is enforced by RLS, not by this module: the place and
// asset rows passed in MUST come from queries made with the requesting
// user's Supabase session. For a bridged visitor, RLS has already reduced
// those rows to bridged-visible ones, so the intersection
// (architect scope ∩ viewer visibility) happens automatically. Never feed
// this function rows fetched with a service-role client.
//
// See docs/architect-knowledge.md for the full model.

import type { Architect } from "./architects";

type PlaceLike = { id: string };
type AssetLike = { place_id: string };

export type ArchitectKnowledge<P extends PlaceLike, A extends AssetLike> = {
  // 'island' architects know the island itself; 'place' architects do not.
  scope: "island" | "place";
  places: P[];
  assets: A[];
};

export function architectKnowledge<P extends PlaceLike, A extends AssetLike>(
  architect: Pick<Architect, "place_id">,
  visiblePlaces: P[],
  visibleAssets: A[]
): ArchitectKnowledge<P, A> {
  const places = architect.place_id
    ? visiblePlaces.filter((place) => place.id === architect.place_id)
    : visiblePlaces;

  const placeIds = new Set(places.map((place) => place.id));

  return {
    scope: architect.place_id ? "place" : "island",
    places,
    assets: visibleAssets.filter((asset) => placeIds.has(asset.place_id)),
  };
}
