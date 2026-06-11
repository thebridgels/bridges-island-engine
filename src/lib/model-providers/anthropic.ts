// The Anthropic adapter behind the provider seam.
//
// This is the only file in the app that knows about the Anthropic SDK.
// The chat action calls complete() and is otherwise provider-blind; a
// second provider later means a second adapter, not a second pipeline.
//
// Credentials: ANTHROPIC_API_KEY, server-only (never NEXT_PUBLIC_*), read
// by the SDK from the environment. It is a model-provider credential, not
// a database credential — it grants zero rows; all data in the prompt was
// fetched through the requesting user's RLS-enforced Supabase session
// before this module is ever called.

import Anthropic from "@anthropic-ai/sdk";
import { CHAT_REPLY_MAX_TOKENS } from "@/lib/architect-chat";

// Lower-cost default for alpha; override with ANTHROPIC_DEFAULT_MODEL.
const FALLBACK_MODEL = "claude-haiku-4-5";

// Stored architect model_name wins when it looks like a real Claude model
// id; anything else falls back to the configured default. Kept permissive
// on purpose (exact ids change); the API 404s unknown ids and we surface
// that as a friendly error rather than hard-validating a list here.
function resolveModel(storedModelName: string | null): string {
  const defaultModel = process.env.ANTHROPIC_DEFAULT_MODEL || FALLBACK_MODEL;
  if (!storedModelName) return defaultModel;
  const trimmed = storedModelName.trim().toLowerCase();
  return /^claude-[a-z0-9.-]+$/.test(trimmed) ? trimmed : defaultModel;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type CompletionTurn = { role: "user" | "assistant"; content: string };

export type CompletionResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string };

export async function complete(
  systemPrompt: string,
  turns: CompletionTurn[],
  storedModelName: string | null
): Promise<CompletionResult> {
  if (!isAnthropicConfigured()) {
    return {
      ok: false,
      error:
        "No model credentials are configured on this server (ANTHROPIC_API_KEY).",
    };
  }

  const model = resolveModel(storedModelName);
  const client = new Anthropic();

  try {
    // No `thinking` param: it must stay valid across every Claude model an
    // architect might configure (the low-cost default doesn't support
    // adaptive thinking), and short grounded replies don't need it.
    const response = await client.messages.create({
      model,
      max_tokens: CHAT_REPLY_MAX_TOKENS,
      system: systemPrompt,
      messages: turns,
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      return { ok: false, error: "The architect had nothing to say." };
    }

    return { ok: true, text, model: response.model };
  } catch (error) {
    if (error instanceof Anthropic.NotFoundError) {
      return {
        ok: false,
        error:
          "The configured model was not recognized. Check the architect's model name.",
      };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return {
        ok: false,
        error: "The server's model credentials were rejected.",
      };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        error: "The model is rate-limited right now. Try again in a moment.",
      };
    }
    if (error instanceof Anthropic.APIError) {
      return {
        ok: false,
        error: `The model could not reply (${error.status ?? "error"}).`,
      };
    }
    return { ok: false, error: "The model could not be reached." };
  }
}
