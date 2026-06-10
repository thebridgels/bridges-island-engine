"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ASSET_TYPES, type AssetType } from "@/lib/assets";

function assetFields(formData: FormData) {
  const rawType = String(formData.get("asset_type") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const contentText = String(formData.get("content_text") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();

  return {
    title: String(formData.get("title") ?? "").trim(),
    asset_type: (ASSET_TYPES as readonly string[]).includes(rawType)
      ? (rawType as AssetType)
      : "note",
    description: description || null,
    content_text: contentText || null,
    url: url || null,
    visibility: formData.get("visibility") === "bridged" ? "bridged" : "private",
  };
}

function placePath(islandId: string, placeId: string) {
  return `/islands/${islandId}/places/${placeId}`;
}

function fail(islandId: string, placeId: string, message: string): never {
  redirect(`${placePath(islandId, placeId)}?error=${encodeURIComponent(message)}`);
}

export async function createAsset(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  if (!islandId || !placeId) redirect("/dashboard");

  const fields = assetFields(formData);
  if (!fields.title) fail(islandId, placeId, "Asset title is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("assets").insert({
    island_id: islandId,
    place_id: placeId,
    owner_id: user.id,
    ...fields,
  });

  if (error) fail(islandId, placeId, error.message);
  revalidatePath(placePath(islandId, placeId));
}

export async function updateAsset(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  const assetId = String(formData.get("asset_id") ?? "");
  if (!islandId || !placeId || !assetId) redirect("/dashboard");

  const fields = assetFields(formData);
  if (!fields.title) fail(islandId, placeId, "Asset title is required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update(fields)
    .eq("id", assetId);

  if (error) fail(islandId, placeId, error.message);
  revalidatePath(placePath(islandId, placeId));
  redirect(placePath(islandId, placeId));
}

export async function deleteAsset(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  const assetId = String(formData.get("asset_id") ?? "");
  if (!islandId || !placeId || !assetId) redirect("/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.from("assets").delete().eq("id", assetId);

  if (error) fail(islandId, placeId, error.message);
  revalidatePath(placePath(islandId, placeId));
}
