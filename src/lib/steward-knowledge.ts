// Steward Knowledge (MVP definition)
//
// Stewards do not own knowledge. They are permissioned interfaces to island
// assets. A steward's knowledge is DERIVED at read time from the island,
// places, and assets it has permission to access — there is no knowledge
// table and no copied content.
//
//   * Island steward (place_id null): island-level information plus all
//     owner-visible places and assets (until restrictions exist).
//   * Place steward: only its assigned place and the assets within it.
//
// The viewer's layer is enforced by RLS, not by this module: the place and
// asset rows passed in MUST come from queries made with the requesting
// user's Supabase session. For a bridged visitor, RLS has already reduced
// those rows to bridged-visible ones, so the intersection
// (steward scope ∩ viewer visibility) happens automatically. Never feed
// this function rows fetched with a service-role client.
//
// See docs/steward-knowledge.md for the full model.

import type { Steward } from "./stewards";

type PlaceLike = { id: string };
type AssetLike = { place_id: string };

export type StewardKnowledge<P extends PlaceLike, A extends AssetLike> = {
  // 'island' stewards know the island itself; 'place' stewards do not.
  scope: "island" | "place";
  places: P[];
  assets: A[];
};

export function stewardKnowledge<P extends PlaceLike, A extends AssetLike>(
  steward: Pick<Steward, "place_id">,
  visiblePlaces: P[],
  visibleAssets: A[]
): StewardKnowledge<P, A> {
  const places = steward.place_id
    ? visiblePlaces.filter((place) => place.id === steward.place_id)
    : visiblePlaces;

  const placeIds = new Set(places.map((place) => place.id));

  return {
    scope: steward.place_id ? "place" : "island",
    places,
    assets: visibleAssets.filter((asset) => placeIds.has(asset.place_id)),
  };
}
