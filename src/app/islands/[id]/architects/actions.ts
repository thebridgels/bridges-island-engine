"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit";
import {
  MODEL_PROVIDERS,
  ARCHITECT_ROLES,
  type ModelProvider,
  type ArchitectRole,
} from "@/lib/architects";

function architectFields(formData: FormData) {
  const rawRole = String(formData.get("role") ?? "");
  const rawProvider = String(formData.get("model_provider") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const modelName = String(formData.get("model_name") ?? "").trim();
  const placeId = String(formData.get("place_id") ?? "");

  return {
    name: String(formData.get("name") ?? "").trim(),
    role: (ARCHITECT_ROLES as readonly string[]).includes(rawRole)
      ? (rawRole as ArchitectRole)
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

function architectsPath(islandId: string) {
  return `/islands/${islandId}/architects`;
}

function fail(islandId: string, message: string): never {
  redirect(`${architectsPath(islandId)}?error=${encodeURIComponent(message)}`);
}

export async function createArchitect(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  if (!islandId) redirect("/dashboard");

  const fields = architectFields(formData);
  if (!fields.name) fail(islandId, "Architect name is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: created, error } = await supabase
    .from("architects")
    .insert({
      island_id: islandId,
      owner_id: user.id,
      ...fields,
    })
    .select("id")
    .single();

  if (error) fail(islandId, error.message);

  await logAuditEvent(supabase, {
    islandId,
    action: "architect.created",
    targetType: "architect",
    targetId: created.id,
    metadata: { name: fields.name, role: fields.role },
  });

  revalidatePath(architectsPath(islandId));
}

export async function updateArchitect(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const architectId = String(formData.get("architect_id") ?? "");
  if (!islandId || !architectId) redirect("/dashboard");

  const fields = architectFields(formData);
  if (!fields.name) fail(islandId, "Architect name is required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("architects")
    .update(fields)
    .eq("id", architectId);

  if (error) fail(islandId, error.message);

  await logAuditEvent(supabase, {
    islandId,
    action: "architect.updated",
    targetType: "architect",
    targetId: architectId,
    metadata: { name: fields.name, role: fields.role },
  });

  revalidatePath(architectsPath(islandId));
  redirect(architectsPath(islandId));
}

export async function deleteArchitect(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const architectId = String(formData.get("architect_id") ?? "");
  if (!islandId || !architectId) redirect("/dashboard");

  const supabase = await createClient();

  const { data: architect } = await supabase
    .from("architects")
    .select("name")
    .eq("id", architectId)
    .maybeSingle();

  const { error } = await supabase.from("architects").delete().eq("id", architectId);

  if (error) fail(islandId, error.message);

  await logAuditEvent(supabase, {
    islandId,
    action: "architect.deleted",
    targetType: "architect",
    targetId: architectId,
    metadata: architect?.name ? { name: architect.name } : {},
  });

  revalidatePath(architectsPath(islandId));
}
