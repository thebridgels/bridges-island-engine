export const PLACE_TYPES = [
  "home",
  "workshop",
  "garden",
  "market",
  "harbor",
  "landmark",
  "other",
] as const;

export type PlaceType = (typeof PLACE_TYPES)[number];

export const PLACE_TYPE_ICONS: Record<PlaceType, string> = {
  home: "🏠",
  workshop: "🔨",
  garden: "🌱",
  market: "🛒",
  harbor: "⚓",
  landmark: "🗿",
  other: "📍",
};

export type Place = {
  id: string;
  island_id: string;
  name: string;
  type: PlaceType;
  description: string | null;
  position_x: number;
  position_y: number;
  visibility: "private" | "bridged";
  created_at: string;
};
