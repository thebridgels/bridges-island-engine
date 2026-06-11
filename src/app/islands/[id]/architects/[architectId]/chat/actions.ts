"use server";

import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit";
import type { Architect } from "@/lib/architects";
import type { Asset } from "@/lib/assets";
import type { Place } from "@/lib/places";
import {
  buildArchitectSystemPrompt,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_RATE_LIMIT_PER_HOUR,
  type ArchitectMessage,
} from "@/lib/architect-chat";
import { complete, type CompletionTurn } from "@/lib/model-providers/anthropic";

function chatPath(islandId: string, architectId: string) {
  return `/islands/${islandId}/architects/${architectId}/chat`;
}

function fail(islandId: string, architectId: string, message: string): never {
  redirect(
    `${chatPath(islandId, architectId)}?error=${encodeURIComponent(message)}`
  );
}

// Owner-only by route policy; RLS is the real boundary underneath — every
// read and write below runs on the caller's session, so even a bug here
// could not surface rows the caller cannot see or write rows RLS forbids.
async function requireOwnedIsland(islandId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: island } = await supabase
    .from("islands")
    .select("id, name, owner_id")
    .eq("id", islandId)
    .maybeSingle();

  if (!island || island.owner_id !== user.id) {
    notFound();
  }

  return { supabase, user, island };
}

export async function startConversation(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const architectId = String(formData.get("architect_id") ?? "");
  if (!islandId || !architectId) redirect("/dashboard");

  const { supabase, user } = await requireOwnedIsland(islandId);

  const { error } = await supabase.from("architect_conversations").insert({
    island_id: islandId,
    architect_id: architectId,
    owner_id: user.id,
  });

  if (error) fail(islandId, architectId, error.message);

  revalidatePath(chatPath(islandId, architectId));
}

export async function sendMessage(formData: FormData) {
  const islandId = String(formData.get("island_id") ?? "");
  const architectId = String(formData.get("architect_id") ?? "");
  const conversationId = String(formData.get("conversation_id") ?? "");
  const content = String(formData.get("message") ?? "").trim();
  if (!islandId || !architectId) redirect("/dashboard");

  if (!content) fail(islandId, architectId, "Say something first.");
  if (content.length > CHAT_MESSAGE_MAX_LENGTH) {
    fail(islandId, architectId, "That message is too long.");
  }

  const { supabase, user, island } = await requireOwnedIsland(islandId);

  // Simple per-user rate limit, counted through the caller's own session.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("architect_messages")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", user.id)
    .eq("role", "user")
    .gte("created_at", hourAgo);

  if ((count ?? 0) >= CHAT_RATE_LIMIT_PER_HOUR) {
    fail(
      islandId,
      architectId,
      `The architect needs a rest — limit of ${CHAT_RATE_LIMIT_PER_HOUR} messages per hour reached.`
    );
  }

  // The architect (RLS-scoped). Phase 1 connects Anthropic only.
  const { data: architectData } = await supabase
    .from("architects")
    .select(
      "id, island_id, place_id, owner_id, name, role, description, model_provider, model_name, visibility, created_at"
    )
    .eq("id", architectId)
    .eq("island_id", islandId)
    .maybeSingle();

  if (!architectData) notFound();
  const architect = architectData as Architect;

  if (architect.model_provider && architect.model_provider !== "anthropic") {
    fail(
      islandId,
      architectId,
      `${architect.name} is configured for a provider that is not connected yet.`
    );
  }

  // Find or create the conversation.
  let activeConversationId = conversationId;
  if (activeConversationId) {
    const { data: conversation } = await supabase
      .from("architect_conversations")
      .select("id")
      .eq("id", activeConversationId)
      .eq("architect_id", architectId)
      .maybeSingle();
    if (!conversation) activeConversationId = "";
  }
  if (!activeConversationId) {
    const { data: created, error: convError } = await supabase
      .from("architect_conversations")
      .insert({
        island_id: islandId,
        architect_id: architectId,
        owner_id: user.id,
      })
      .select("id")
      .single();
    if (convError) fail(islandId, architectId, convError.message);
    activeConversationId = created.id;
  }

  // Prior turns, for conversational continuity (bounded to the most
  // recent 20 to keep the prompt small).
  const { data: historyData } = await supabase
    .from("architect_messages")
    .select("role, content, created_at")
    .eq("conversation_id", activeConversationId)
    .order("created_at", { ascending: false })
    .limit(20);

  const history = ((historyData ?? []) as Pick<
    ArchitectMessage,
    "role" | "content" | "created_at"
  >[]).reverse();

  // Record the owner's message first — it happened regardless of whether
  // the model replies.
  const { error: userMsgError } = await supabase
    .from("architect_messages")
    .insert({
      conversation_id: activeConversationId,
      island_id: islandId,
      actor_id: user.id,
      role: "user",
      content,
      created_by_ai: false,
    });

  if (userMsgError) fail(islandId, architectId, userMsgError.message);

  // Context: ONLY architectKnowledge() over rows from the caller's session.
  const [placeRes, assetRes] = await Promise.all([
    supabase
      .from("places")
      .select("id, name, type, description")
      .eq("island_id", islandId)
      .order("created_at", { ascending: true }),
    supabase
      .from("assets")
      .select(
        "id, place_id, title, description, asset_type, content_text, url, source_type, created_by_ai"
      )
      .eq("island_id", islandId)
      .order("created_at", { ascending: true }),
  ]);

  const systemPrompt = buildArchitectSystemPrompt(
    architect,
    island.name,
    (placeRes.data ?? []) as Pick<
      Place,
      "id" | "name" | "type" | "description"
    >[],
    (assetRes.data ?? []) as Pick<
      Asset,
      | "id"
      | "place_id"
      | "title"
      | "description"
      | "asset_type"
      | "content_text"
      | "url"
      | "source_type"
      | "created_by_ai"
    >[]
  );

  const turns: CompletionTurn[] = [
    ...history.map(
      (message): CompletionTurn => ({
        role: message.role === "architect" ? "assistant" : "user",
        content: message.content,
      })
    ),
    { role: "user", content },
  ];

  const result = await complete(systemPrompt, turns, architect.model_name);

  if (!result.ok) {
    fail(islandId, architectId, result.error);
  }

  // The reply, written through the owner's session and structurally marked
  // AI (the CHECK constraint ties created_by_ai to the architect role).
  const { error: replyError } = await supabase.from("architect_messages").insert({
    conversation_id: activeConversationId,
    island_id: islandId,
    actor_id: user.id,
    role: "architect",
    content: result.text.slice(0, CHAT_MESSAGE_MAX_LENGTH),
    created_by_ai: true,
    model_provider: "anthropic",
    model_name: result.model,
  });

  if (replyError) fail(islandId, architectId, replyError.message);

  await supabase
    .from("architect_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", activeConversationId);

  // Activity, never content: the ledger records that the exchange happened.
  await logAuditEvent(supabase, {
    islandId,
    action: "architect.replied",
    targetType: "architect",
    targetId: architect.id,
    metadata: { name: architect.name },
  });

  revalidatePath(chatPath(islandId, architectId));
}
