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
  created_at: string;
  updated_at: string;
};
