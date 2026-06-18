import { structured } from "../ai/client.js";
import { MISSION, MEMORY_TYPES } from "../ai/prompts.js";
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

const SYSTEM = `${MISSION}

You are the Memory Engine. Extract the relationship memories worth remembering
about this contact from their notes and conversation history.

${MEMORY_TYPES}

Rules:
- One clean, specific fact per memory. Write it as something a person would
  actually want recalled ("Daughter Maya started college at Purdue", not
  "mentioned daughter").
- confidence is 0-1: how sure you are the fact is real and durable.
- Prefer fewer, higher-signal memories over an exhaustive dump.
- Never invent. If the history is thin, return few or no memories.`;

export async function extractMemories(
  ctx: ContactContext,
): Promise<ExtractedMemory[]> {
  const result = await structured<{ memories: ExtractedMemory[] }>({
    system: SYSTEM,
    user: `Extract relationship memories from the following:\n\n${formatContext(ctx)}`,
    schema,
    maxTokens: 3000,
    effort: "high",
  });

  return (result.memories ?? [])
    .filter((m) => m.content?.trim() && MEMORY_TYPE_VALUES.includes(m.type))
    .map((m) => ({
      ...m,
      confidence: Math.max(0, Math.min(1, m.confidence ?? 0.7)),
    }));
}
