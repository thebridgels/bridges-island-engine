import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IslandSilhouette } from "@/components/island-silhouette";
import {
  ARCHITECT_ROLE_ICONS,
  formatRole,
  type Architect,
} from "@/lib/architects";
import { architectKnowledge } from "@/lib/architect-knowledge";
import type { Place } from "@/lib/places";
import {
  type ArchitectConversation,
  type ArchitectMessage,
  CHAT_MESSAGE_MAX_LENGTH,
} from "@/lib/architect-chat";
import {
  isAnthropicConfigured,
  resolveModel,
} from "@/lib/model-providers/anthropic";
import { sendMessage, startConversation } from "./actions";

export default async function ArchitectChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; architectId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, architectId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: island } = await supabase
    .from("islands")
    .select("id, name, owner_id")
    .eq("id", id)
    .maybeSingle();

  // Chat is for owners only (phase 1). For everyone else — including
  // bridged visitors — this page does not exist. RLS would return zero
  // conversation rows anyway; the 404 keeps the page from acknowledging it.
  if (!island || island.owner_id !== user.id) {
    notFound();
  }

  const { data: architectData } = await supabase
    .from("architects")
    .select(
      "id, island_id, place_id, owner_id, name, role, description, model_provider, model_name, visibility, created_at"
    )
    .eq("id", architectId)
    .eq("island_id", island.id)
    .maybeSingle();

  if (!architectData) {
    notFound();
  }
  const architect = architectData as Architect;

  const connectable =
    isAnthropicConfigured() &&
    (!architect.model_provider || architect.model_provider === "anthropic");

  // What the architect can see, derived exactly as the prompt will be —
  // testable against the card with no model call.
  const [placeRes, assetRes] = await Promise.all([
    supabase
      .from("places")
      .select("id, name, type")
      .eq("island_id", island.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("assets")
      .select("id, place_id, title")
      .eq("island_id", island.id)
      .order("created_at", { ascending: true }),
  ]);
  const places = (placeRes.data ?? []) as Pick<Place, "id" | "name" | "type">[];
  const assets = (assetRes.data ?? []) as {
    id: string;
    place_id: string;
    title: string;
  }[];
  const knowledge = architectKnowledge(architect, places, assets);

  // Principle #14 disclosure values. The model shown is resolved from the
  // SAME function the provider call uses, so the owner sees exactly what
  // will be requested. No data flow or provider behavior changes here.
  const effectiveProvider = architect.model_provider ?? "anthropic";
  const providerLabel =
    effectiveProvider === "anthropic" ? "Anthropic" : effectiveProvider;
  const modelLabel = connectable ? resolveModel(architect.model_name) : null;
  const scopedPlace = architect.place_id
    ? places.find((place) => place.id === architect.place_id)
    : undefined;
  const scopeLabel = architect.place_id
    ? `place-scoped — at ${scopedPlace?.name ?? "its place"}`
    : "island-wide — the whole island";

  // Latest conversation with this architect, plus its transcript.
  const { data: conversationData } = await supabase
    .from("architect_conversations")
    .select("id, island_id, architect_id, owner_id, title, created_at, updated_at")
    .eq("architect_id", architect.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const conversation = conversationData as ArchitectConversation | null;

  let messages: ArchitectMessage[] = [];
  if (conversation) {
    const { data: messageData } = await supabase
      .from("architect_messages")
      .select(
        "id, conversation_id, island_id, actor_id, role, content, created_by_ai, model_provider, model_name, created_at"
      )
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });
    messages = (messageData ?? []) as ArchitectMessage[];
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="animate-arrive relative h-24 overflow-hidden rounded-xl">
        <IslandSilhouette
          islandId={island.id}
          className="absolute inset-0 h-full w-full"
        />
        <Link
          href={`/islands/${island.id}/architects`}
          className="absolute left-4 top-3 text-sm font-medium text-white underline [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]"
        >
          ← Architects of {island.name}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">
          {ARCHITECT_ROLE_ICONS[architect.role] ?? "📐"} {architect.name}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {formatRole(architect.role)} ·{" "}
          {architect.place_id ? "place-scoped" : "island-wide"} · every reply
          is AI-generated and recorded on this island.
        </p>
      </div>

      {/* Principle #14: disclose AI, provider, model, scope, owner-only,
          and ledger-logging before the owner writes. */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-900/40">
        <p className="font-medium">Before you write — what this is</p>
        <ul className="mt-2 space-y-1 text-gray-600 dark:text-gray-400">
          <li>
            This is an <span className="font-medium">AI presence</span>, not a
            person. Every reply is AI-generated and marked &ldquo;
            {architect.name} · AI&rdquo;.
          </li>
          <li>
            Provider: <span className="font-medium">{providerLabel}</span>
            {modelLabel ? (
              <>
                {" · "}Model: <span className="font-medium">{modelLabel}</span>
              </>
            ) : (
              <>
                {" · "}
                <span className="font-medium">not connected yet</span>
              </>
            )}
          </li>
          <li>
            Scope: <span className="font-medium">{scopeLabel}</span>. It sees
            exactly what you may see, has no tools, and cannot change the
            island.
          </li>
          <li>
            This chat is <span className="font-medium">owner-only</span>, and
            every exchange is recorded in this island&rsquo;s ledger — activity
            only, never message content.
          </li>
        </ul>
      </div>

      <details className="rounded-lg border border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
        <summary className="cursor-pointer font-medium">
          What {architect.name} can see right now
        </summary>
        <p className="mt-2">
          {knowledge.scope === "island" ? "The island, " : ""}
          {knowledge.places.length}{" "}
          {knowledge.places.length === 1 ? "place" : "places"} ·{" "}
          {knowledge.assets.length}{" "}
          {knowledge.assets.length === 1 ? "asset" : "assets"} — derived for
          your session at the moment you send a message. The architect sees
          exactly what you may see; it has no tools and cannot change the
          island.
        </p>
      </details>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Transcript */}
      {messages.length > 0 ? (
        <ul className="space-y-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={
                message.role === "architect"
                  ? "mr-8 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900"
                  : "ml-8 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
              }
            >
              <p className="text-xs font-medium text-gray-500">
                {message.role === "architect"
                  ? `${ARCHITECT_ROLE_ICONS[architect.role] ?? "📐"} ${
                      architect.name
                    } · AI`
                  : "You"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {message.content}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(message.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {connectable
            ? `No conversation yet. ${architect.name} is listening.`
            : `${architect.name} cannot speak yet.`}
        </p>
      )}

      {/* Composer */}
      {connectable ? (
        <section className="space-y-3">
          <form action={sendMessage} className="space-y-3">
            <input type="hidden" name="island_id" value={island.id} />
            <input type="hidden" name="architect_id" value={architect.id} />
            {conversation && (
              <input
                type="hidden"
                name="conversation_id"
                value={conversation.id}
              />
            )}
            <textarea
              name="message"
              rows={3}
              required
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              placeholder={`Ask ${architect.name} about the island…`}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
            >
              Send
            </button>
          </form>
          {conversation && messages.length > 0 && (
            <form action={startConversation}>
              <input type="hidden" name="island_id" value={island.id} />
              <input type="hidden" name="architect_id" value={architect.id} />
              <button type="submit" className="text-xs text-gray-500 underline">
                Start a new conversation
              </button>
            </form>
          )}
        </section>
      ) : (
        <p className="rounded-md border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
          {architect.model_provider && architect.model_provider !== "anthropic"
            ? `${architect.name} is configured for "${architect.model_provider}", which is not connected yet. Phase 1 connects Anthropic only.`
            : "No model credentials are configured on this server yet (ANTHROPIC_API_KEY)."}
        </p>
      )}
    </main>
  );
}
