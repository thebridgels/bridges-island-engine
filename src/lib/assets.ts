export const ASSET_TYPES = [
  "document",
  "image",
  "link",
  "note",
  "file",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_ICONS: Record<AssetType, string> = {
  document: "📄",
  image: "🖼️",
  link: "🔗",
  note: "📝",
  file: "📦",
};

export const ASSET_SOURCE_TYPES = [
  "original",
  "uploaded",
  "ai_generated",
  "imported",
  "linked",
] as const;

export type AssetSourceType = (typeof ASSET_SOURCE_TYPES)[number];

export const ASSET_SOURCE_LABELS: Record<AssetSourceType, string> = {
  original: "made here",
  uploaded: "uploaded",
  ai_generated: "AI-generated",
  imported: "imported",
  linked: "linked",
};

// The Asset Presence's perceivable contents category (non-sensitive).
// 'local_reference' means the bytes live on the owner's own device; only the
// owner can see the file's details (see AssetFile + asset_files RLS).
export type AssetContentsKind = "none" | "inline" | "link" | "local_reference";

export type Asset = {
  id: string;
  island_id: string;
  place_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  asset_type: AssetType;
  content_text: string | null;
  url: string | null;
  visibility: "private" | "bridged";
  source_type: AssetSourceType;
  created_by_ai: boolean;
  source_note: string | null;
  contents_kind: AssetContentsKind;
  created_at: string;
  updated_at: string;
};

// Asset Contents locator (owner-only). Bridges never stores the bytes — only
// these details, and the checksum is computed in the browser.
export type AssetFile = {
  id: string;
  asset_id: string;
  storage_kind: "local_reference";
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  checksum_sha256: string | null;
  checksum_algo: string;
  local_path_note: string | null;
  source_last_modified: string | null;
  registered_at: string;
};

// Shown wherever a local file is registered or displayed to its owner.
export const LOCAL_FILE_DISCLOSURE =
  "This file stays on your device. Bridges saves only its details. It may not be available from other devices.";

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
