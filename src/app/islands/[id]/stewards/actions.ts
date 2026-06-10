"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MODEL_PROVIDERS,
  STEWARD_ROLES,
  type ModelProvider,
  type StewardRole,
} from "@/lib/stewards";

function stewardFields(formData: FormData) {
  const rawRole = String(formData.get("role") ?? "");
  const rawProvider = String(formData.get("model_provider") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const modelName = String(formData.get("model_name") ?? "").trim();
  const placeId = String(formData.get("place_id") ?? "");

  return {
    name: String(formData.get("name") ?? "").trim(),
    role: (STEWARD_ROLES as readonly string[]).includes(rawRole)
      ? (rawRole as StewardRole)
      : "librarian",
    description: description || null,
    place_id: placeId || null,
    model_provider: (MODEL_PROVIDERS as readonly string[]).includes(rawProvider)
      ? (rawProvider as ModelProvider)
      : null,
    model_name: modelName || null,
    visibility: formData.get("visibility") === "bridged" ? "bridged" : "private",
  };
}

function stewardsPath(islandId: string) {
  return `/islands/${islandId}/stewards`;
}

function fail(islandId: string, message: string): never {
  redirect(`${stewardsPath(islandId)}?error=${encodeURIComponent(message)}`);
}

export async function createSteward(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  if (!islandId) redirect("/dashboard");

  const fields = stewardFields(formData);
  if (!fields.name) fail(islandId, "Steward name is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("stewards").insert({
    island_id: islandId,
    owner_id: user.id,
    ...fields,
  });

  if (error) fail(islandId, error.message);
  revalidatePath(stewardsPath(islandId));
}

export async function updateSteward(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const stewardId = String(formData.get("steward_id") ?? "");
  if (!islandId || !stewardId) redirect("/dashboard");

  const fields = stewardFields(formData);
  if (!fields.name) fail(islandId, "Steward name is required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("stewards")
    .update(fields)
    .eq("id", stewardId);

  if (error) fail(islandId, error.message);
  revalidatePath(stewardsPath(islandId));
  redirect(stewardsPath(islandId));
}

export async function deleteSteward(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const stewardId = String(formData.get("steward_id") ?? "");
  if (!islandId || !stewardId) redirect("/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.from("stewards").delete().eq("id", stewardId);

  if (error) fail(islandId, error.message);
  revalidatePath(stewardsPath(islandId));
}
