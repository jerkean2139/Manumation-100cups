import { structured } from "../ai/client.js";
import { loadConfig } from "../ai/config.js";
import { stripDashes } from "./voice-engine.js";
import { formatContext } from "./format.js";
import type { ContactContext, ExtractedMemory, MemoryType } from "../types.js";

/**
 * MODULE 2 — The Memory Engine.
 *
 * The moat. Reads notes, conversations, and fields and extracts durable
 * relationship intelligence: family, goals, wins, challenges, life events.
 * It is deliberately conservative — it would rather miss a fact than store
 * trivia, because trivia is what makes "personalization" feel creepy.
 */

const MEMORY_TYPE_VALUES: MemoryType[] = [
  "family",
  "personal",
  "goals",
  "wins",
  "challenges",
  "frustrations",
  "hobbies",
  "business",
  "life_event",
];

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    memories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: MEMORY_TYPE_VALUES },
          content: { type: "string" },
          confidence: { type: "number" },
          source: { type: "string" },
        },
        required: ["type", "content", "confidence"],
      },
    },
  },
  required: ["memories"],
};

export async function extractMemories(
  ctx: ContactContext,
): Promise<ExtractedMemory[]> {
  const cfg = await loadConfig();
  const system = `${cfg.mission}

You are the Memory Engine. Extract the relationship memories worth remembering
about this contact from their notes and conversation history.

${cfg.memoryGuidance}

Rules:
- One clean, specific fact per memory. Write it as something a person would
  actually want recalled ("Daughter Maya started college at Purdue", not
  "mentioned daughter").
- confidence is 0-1: how sure you are the fact is real and durable.
- Prefer fewer, higher-signal memories over an exhaustive dump.
- Never invent. If the history is thin, return few or no memories.`;

  const result = await structured<{ memories: ExtractedMemory[] }>({
    system,
    user: `Extract relationship memories from the following:\n\n${formatContext(ctx)}`,
    schema,
    maxTokens: 3000,
    effort: cfg.effort,
  });

  return (result.memories ?? [])
    .filter((m) => m.content?.trim() && MEMORY_TYPE_VALUES.includes(m.type))
    .map((m) => ({
      ...m,
      content: stripDashes(m.content),
      confidence: Math.max(0, Math.min(1, m.confidence ?? 0.7)),
    }));
}
