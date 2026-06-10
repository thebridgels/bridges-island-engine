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
  created_at: string;
  updated_at: string;
};
