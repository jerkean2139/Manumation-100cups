import { structured } from "../ai/client.js";
import { MISSION, JEREMY_VOICE, HUMANITY_STANDARDS } from "../ai/prompts.js";
import { formatContext } from "./format.js";
import type { Channel, ContactContext, DraftReply, Snapshot } from "../types.js";

/**
 * MODULE 4 — The Jeremy Voice Engine.
 *
 * Produces two reply options to an inbound message:
 *   Option 1 — warm and conversational
 *   Option 2 — direct and practical
 * Both must sound like Jeremy and clear the Humanity Standards.
 */

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    warm: { type: "string" },
    direct: { type: "string" },
  },
  required: ["warm", "direct"],
};

function channelGuidance(channel: Channel): string {
  switch (channel) {
    case "sms":
      return "Channel: SMS. Keep it short — 1-3 sentences, no greeting/sign-off boilerplate.";
    case "email":
      return "Channel: Email. A short, warm note. A light greeting is fine; no corporate signature.";
    case "inbox":
    default:
      return "Channel: Inbox reply. Conversational, concise, like a real chat.";
  }
}

const SYSTEM = `${MISSION}

${JEREMY_VOICE}

${HUMANITY_STANDARDS}

You are the Jeremy Voice Engine. Given an inbound message and the relationship
snapshot, write TWO replies as Jeremy:
- warm: warm and conversational
- direct: direct and practical

Both must:
- sound unmistakably like Jeremy (see the voice standard)
- be grounded in what actually matters to this person
- reference at most ONE specific memory, and only if it lands naturally
- never use a dead phrase, never feel automated, never pretend false intimacy
- actually respond to what the person said`;

export async function writeReplies(
  ctx: ContactContext,
  snapshot: Snapshot,
  inboundMessage: string,
  channel: Channel,
): Promise<DraftReply[]> {
  const user = `${formatContext(ctx)}

RELATIONSHIP SNAPSHOT:
- Why they matter: ${snapshot.whyTheyMatter}
- Current season: ${snapshot.currentSeason}
- Best memory: ${snapshot.bestMemory}
- Last meaningful moment: ${snapshot.lastMeaningfulMoment}
- Next best conversation: ${snapshot.nextBestConversation}
- Avoid saying: ${snapshot.avoidSaying.join("; ") || "(nothing flagged)"}

INBOUND MESSAGE from ${ctx.name}:
"${inboundMessage}"

${channelGuidance(channel)}

Write the two replies.`;

  const result = await structured<{ warm: string; direct: string }>({
    system: SYSTEM,
    user,
    schema,
    maxTokens: 2000,
    effort: "high",
  });

  return [
    { tone: "warm", channel, text: result.warm.trim() },
    { tone: "direct", channel, text: result.direct.trim() },
  ];
}

/** Rewrite a single reply that failed the Humanity audit, using the feedback. */
export async function rewriteReply(
  ctx: ContactContext,
  snapshot: Snapshot,
  inboundMessage: string,
  draft: DraftReply,
  feedback: string,
): Promise<string> {
  const schemaOne = {
    type: "object",
    additionalProperties: false,
    properties: { text: { type: "string" } },
    required: ["text"],
  };

  const user = `${formatContext(ctx)}

RELATIONSHIP SNAPSHOT:
- Why they matter: ${snapshot.whyTheyMatter}
- Current season: ${snapshot.currentSeason}
- Next best conversation: ${snapshot.nextBestConversation}
- Avoid saying: ${snapshot.avoidSaying.join("; ") || "(nothing flagged)"}

INBOUND MESSAGE from ${ctx.name}:
"${inboundMessage}"

${channelGuidance(draft.channel)}

This ${draft.tone} reply was rejected by the Humanity Auditor:
"${draft.text}"

Auditor feedback: ${feedback}

Rewrite it so it clears the Humanity Standards while keeping the ${draft.tone}
tone and sounding like Jeremy.`;

  const result = await structured<{ text: string }>({
    system: SYSTEM,
    user,
    schema: schemaOne,
    maxTokens: 1500,
    effort: "high",
  });

  return result.text.trim();
}
