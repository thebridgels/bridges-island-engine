"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLACE_TYPES, type PlaceType } from "@/lib/places";

function placeFields(formData: FormData) {
  const rawType = String(formData.get("type") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  return {
    name: String(formData.get("name") ?? "").trim(),
    type: (PLACE_TYPES as readonly string[]).includes(rawType)
      ? (rawType as PlaceType)
      : "landmark",
    description: description || null,
    position_x: clampPosition(formData.get("position_x")),
    position_y: clampPosition(formData.get("position_y")),
    visibility: formData.get("visibility") === "bridged" ? "bridged" : "private",
  };
}

function clampPosition(value: FormDataEntryValue | null): number {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

function fail(islandId: string, message: string): never {
  redirect(`/islands/${islandId}?error=${encodeURIComponent(message)}`);
}

export async function createPlace(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  if (!islandId) redirect("/dashboard");

  const fields = placeFields(formData);
  if (!fields.name) fail(islandId, "Place name is required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("places")
    .insert({ island_id: islandId, ...fields });

  if (error) fail(islandId, error.message);
  revalidatePath(`/islands/${islandId}`);
}

export async function updatePlace(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  if (!islandId || !placeId) redirect("/dashboard");

  const fields = placeFields(formData);
  if (!fields.name) fail(islandId, "Place name is required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("places")
    .update(fields)
    .eq("id", placeId);

  if (error) fail(islandId, error.message);
  revalidatePath(`/islands/${islandId}`);
  redirect(`/islands/${islandId}`);
}

export async function deletePlace(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  if (!islandId || !placeId) redirect("/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.from("places").delete().eq("id", placeId);

  if (error) fail(islandId, error.message);
  revalidatePath(`/islands/${islandId}`);
}
