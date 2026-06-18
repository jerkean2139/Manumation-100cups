import Anthropic from "@anthropic-ai/sdk";
import { env, hasAnthropic } from "../env.js";

/**
 * The relationship intelligence engine runs on Claude.
 *
 * Every engine in this product (Memory, Relationship, Voice, Humanity) is a
 * structured call to this client. We default to claude-opus-4-8 with adaptive
 * thinking — the work here is judgment-heavy (what *matters* about a person),
 * which is exactly what adaptive thinking is for.
 */

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!hasAnthropic()) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured — the relationship engine is offline.",
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropic.apiKey });
  }
  return client;
}

export interface StructuredOptions {
  system: string;
  user: string;
  /** JSON schema the response must conform to. */
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Lower effort for cheaper, faster passes (e.g. the audit). */
  effort?: "low" | "medium" | "high";
}

/**
 * Run a structured-output call and return parsed JSON of type T.
 *
 * Uses `output_config.format` (json_schema) so the model is constrained to a
 * valid, parseable object — no prefills, no brittle string parsing.
 */
export async function structured<T>(opts: StructuredOptions): Promise<T> {
  const anthropic = getClient();

  // The body uses current API features (adaptive thinking, output_config) that
  // the pinned SDK's types predate. The SDK forwards unknown body fields to the
  // API unchanged, so we build the body explicitly and cast through `unknown`.
  const body = {
    model: env.anthropic.model,
    max_tokens: opts.maxTokens ?? 4096,
    thinking: { type: "adaptive" },
    output_config: {
      effort: opts.effort ?? "high",
      format: {
        type: "json_schema",
        schema: opts.schema,
      },
    },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  };

  const response = await anthropic.messages.create(
    body as unknown as Anthropic.MessageCreateParamsNonStreaming,
  );

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Engine returned no text content.");
  }

  try {
    return JSON.parse(textBlock.text) as T;
  } catch {
    throw new Error(`Engine returned unparseable JSON: ${textBlock.text.slice(0, 200)}`);
  }
}

export { hasAnthropic };
