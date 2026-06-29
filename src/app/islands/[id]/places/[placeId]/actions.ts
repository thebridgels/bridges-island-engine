"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit";
import {
  ASSET_SOURCE_TYPES,
  ASSET_TYPES,
  type AssetSourceType,
  type AssetType,
} from "@/lib/assets";

function assetFields(formData: FormData) {
  const rawType = String(formData.get("asset_type") ?? "");
  const rawSourceType = String(formData.get("source_type") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const contentText = String(formData.get("content_text") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const sourceNote = String(formData.get("source_note") ?? "").trim();

  return {
    title: String(formData.get("title") ?? "").trim(),
    asset_type: (ASSET_TYPES as readonly string[]).includes(rawType)
      ? (rawType as AssetType)
      : "note",
    description: description || null,
    content_text: contentText || null,
    url: url || null,
    visibility: formData.get("visibility") === "bridged" ? "bridged" : "private",
    source_type: (ASSET_SOURCE_TYPES as readonly string[]).includes(rawSourceType)
      ? (rawSourceType as AssetSourceType)
      : "original",
    created_by_ai: formData.get("created_by_ai") === "on",
    source_note: sourceNote || null,
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

  const { data: created, error } = await supabase
    .from("assets")
    .insert({
      island_id: islandId,
      place_id: placeId,
      owner_id: user.id,
      ...fields,
    })
    .select("id")
    .single();

  if (error) fail(islandId, placeId, error.message);

  await logAuditEvent(supabase, {
    islandId,
    action: "asset.created",
    targetType: "asset",
    targetId: created.id,
    metadata: { title: fields.title, source_type: fields.source_type },
  });

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

  await logAuditEvent(supabase, {
    islandId,
    action: "asset.updated",
    targetType: "asset",
    targetId: assetId,
    metadata: { title: fields.title },
  });

  revalidatePath(placePath(islandId, placeId));
  redirect(placePath(islandId, placeId));
}

// Register an existing file on the owner's device as an Asset, WITHOUT
// uploading its bytes. The form carries metadata only (computed client-side);
// the atomic `register_local_asset` RPC creates the Presence row
// (contents_kind='local_reference') and the owner-only asset_files row.
export async function registerLocalDocument(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  if (!islandId || !placeId) redirect("/dashboard");

  const title = String(formData.get("title") ?? "").trim();
  const fileName = String(formData.get("file_name") ?? "").trim();
  if (!title) fail(islandId, placeId, "A title is required.");
  if (!fileName) fail(islandId, placeId, "Select a file to register.");

  const rawType = String(formData.get("asset_type") ?? "");
  const assetType = (ASSET_TYPES as readonly string[]).includes(rawType)
    ? (rawType as AssetType)
    : "document";
  const description = String(formData.get("description") ?? "").trim() || null;
  const visibility =
    formData.get("visibility") === "bridged" ? "bridged" : "private";
  const localPathNote =
    String(formData.get("local_path_note") ?? "").trim() || null;
  const mimeType = String(formData.get("mime_type") ?? "").trim() || null;
  const checksumRaw = String(formData.get("checksum_sha256") ?? "").trim();
  const checksum = /^[0-9a-f]{64}$/.test(checksumRaw) ? checksumRaw : null;
  const sizeNum = Number(formData.get("file_size"));
  const fileSize =
    Number.isFinite(sizeNum) && sizeNum >= 0 ? Math.round(sizeNum) : null;
  const lastModified =
    String(formData.get("source_last_modified") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assetId, error } = await supabase.rpc("register_local_asset", {
    p_island_id: islandId,
    p_place_id: placeId,
    p_title: title,
    p_description: description,
    p_asset_type: assetType,
    p_source_type: "imported",
    p_source_note: null,
    p_visibility: visibility,
    p_file_name: fileName,
    p_file_size: fileSize,
    p_mime_type: mimeType,
    p_checksum_sha256: checksum,
    p_local_path_note: localPathNote,
    p_source_last_modified: lastModified,
  });

  if (error) fail(islandId, placeId, error.message);

  await logAuditEvent(supabase, {
    islandId,
    action: "asset.created",
    targetType: "asset",
    targetId: assetId as string,
    metadata: { title, source_type: "imported", storage_kind: "local_reference" },
  });

  revalidatePath(placePath(islandId, placeId));
}

export async function deleteAsset(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  const assetId = String(formData.get("asset_id") ?? "");
  if (!islandId || !placeId || !assetId) redirect("/dashboard");

  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("title")
    .eq("id", assetId)
    .maybeSingle();

  const { error } = await supabase.from("assets").delete().eq("id", assetId);

  if (error) fail(islandId, placeId, error.message);

  await logAuditEvent(supabase, {
    islandId,
    action: "asset.deleted",
    targetType: "asset",
    targetId: assetId,
    metadata: asset?.title ? { title: asset.title } : {},
  });

  revalidatePath(placePath(islandId, placeId));
}
