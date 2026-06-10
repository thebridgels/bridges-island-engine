export const STEWARD_ROLES = [
  "librarian",
  "archivist",
  "curator",
  "researcher",
  "builder",
  "teacher",
  "receptionist",
  "guardian",
] as const;

export type StewardRole = (typeof STEWARD_ROLES)[number];

export const STEWARD_ROLE_ICONS: Record<StewardRole, string> = {
  librarian: "📚",
  archivist: "🗃️",
  curator: "🏛️",
  researcher: "🔬",
  builder: "🛠️",
  teacher: "🧑‍🏫",
  receptionist: "🛎️",
  guardian: "🛡️",
};

export const MODEL_PROVIDERS = ["anthropic", "openai", "other"] as const;

export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export type Steward = {
  id: string;
  island_id: string;
  place_id: string | null;
  owner_id: string;
  name: string;
  role: StewardRole;
  description: string | null;
  model_provider: ModelProvider | null;
  model_name: string | null;
  visibility: "private" | "bridged";
  created_at: string;
};

export function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
