import { structured } from "../ai/client.js";
import { MISSION } from "../ai/prompts.js";
import { stripDashes } from "./voice-engine.js";
import { formatContext } from "./format.js";
import type {
  ContactContext,
  ExtractedMemory,
  RelationshipStage,
  Snapshot,
} from "../types.js";

/**
 * MODULE 3 — The Relationship Engine.
 *
 * Turns memories + history into a living relationship profile: the six core
 * scores, the relationship stage and current season, the best memory, the last
 * meaningful moment, what to avoid — and the hero output, Next Best Conversation.
 */

const STAGES: RelationshipStage[] = [
  "stranger",
  "acquaintance",
  "building",
  "established",
  "trusted",
  "at_risk",
  "dormant",
];

// Structured-output JSON schema doesn't support minimum/maximum on numbers.
// The 0-100 range is enforced in the prompt and clamped on read.
const score = { type: "number" };

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scores: {
      type: "object",
      additionalProperties: false,
      properties: {
        relationshipHealth: score,
        trust: score,
        humanity: score,
        hundredCups: score,
        engagement: score,
        nextBestConversation: score,
      },
      required: [
        "relationshipHealth",
        "trust",
        "humanity",
        "hundredCups",
        "engagement",
        "nextBestConversation",
      ],
    },
    stage: { type: "string", enum: STAGES },
    currentSeason: { type: "string" },
    bestMemory: { type: "string" },
    lastMeaningfulMoment: { type: "string" },
    avoidSaying: { type: "array", items: { type: "string" } },
    nextBestConversation: { type: "string" },
    whyTheyMatter: { type: "string" },
  },
  required: [
    "scores",
    "stage",
    "currentSeason",
    "bestMemory",
    "lastMeaningfulMoment",
    "avoidSaying",
    "nextBestConversation",
    "whyTheyMatter",
  ],
};

const SYSTEM = `${MISSION}

You are the Relationship Engine. Build a relationship snapshot that answers:
who is this person, why do they matter, what's happening in their world, what
should Jeremy talk about next, and what should he avoid.

Scores (0-100), each defined to help Jeremy make a better decision, not vanity:
- relationshipHealth: overall health of the bond
- trust: how much trust has been earned, both ways
- humanity: how human vs transactional the relationship feels
- hundredCups: the 100 Cups balance of deposits (helping, remembering, referring,
  encouraging, listening, supporting, celebrating) minus withdrawals (pitching too
  early, ignoring context, generic outreach, over-automation, excessive asking,
  poor timing). 50 = neutral, higher = net deposits.
- engagement: how actively the contact is engaging right now
- nextBestConversation: how ripe the moment is for a meaningful conversation

THE HERO OUTPUT is nextBestConversation (the text): the single most meaningful
conversation Jeremy could have next. Not "follow up." Not "check in." A real,
specific, human conversation grounded in what matters to this person right now.

avoidSaying: concrete things that would damage trust if said now.
currentSeason: the emotional/life context the contact is in (e.g. "Heads-down
launching their new clinic; stretched thin but hopeful").
Be specific and grounded in the evidence. If history is thin, say so honestly and
score conservatively rather than inventing depth.`;

export async function buildSnapshot(
  ctx: ContactContext,
  memories: ExtractedMemory[],
): Promise<Snapshot> {
  const memoryBlock = memories.length
    ? memories.map((m) => `- [${m.type}] ${m.content}`).join("\n")
    : "(No memories extracted yet.)";

  const user = `${formatContext(ctx)}

EXTRACTED MEMORIES:
${memoryBlock}

Build the relationship snapshot.`;

  const snapshot = await structured<Snapshot>({
    system: SYSTEM,
    user,
    schema,
    maxTokens: 4000,
    effort: "high",
  });

  // Defensively clamp every score to 0-100 (the schema can't enforce the range).
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  for (const key of Object.keys(snapshot.scores) as (keyof typeof snapshot.scores)[]) {
    snapshot.scores[key] = clamp(snapshot.scores[key] ?? 0);
  }

  // No em dashes anywhere, including the tiles shown on screen.
  snapshot.currentSeason = stripDashes(snapshot.currentSeason);
  snapshot.bestMemory = stripDashes(snapshot.bestMemory);
  snapshot.lastMeaningfulMoment = stripDashes(snapshot.lastMeaningfulMoment);
  snapshot.nextBestConversation = stripDashes(snapshot.nextBestConversation);
  snapshot.whyTheyMatter = stripDashes(snapshot.whyTheyMatter);
  snapshot.avoidSaying = snapshot.avoidSaying.map(stripDashes);
  return snapshot;
}
