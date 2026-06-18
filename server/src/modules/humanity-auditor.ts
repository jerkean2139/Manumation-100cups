import { structured } from "../ai/client.js";
import { MISSION, JEREMY_VOICE, HUMANITY_STANDARDS } from "../ai/prompts.js";
import type { DraftReply, HumanityGrade, Snapshot } from "../types.js";

/**
 * MODULE 5 — The Humanity Auditor.
 *
 * Grades a reply on seven dimensions and computes a weighted overall score.
 * Anything below the threshold (default 95) is rejected — the orchestrator
 * then rewrites it once automatically.
 */

// Structured-output JSON schema doesn't support minimum/maximum on numbers.
// The 0-100 range is enforced in the prompt; weighting handles the rest.
const dim = { type: "number" };

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    specificity: dim,
    authenticity: dim,
    brevity: dim,
    relationshipAccuracy: dim,
    jeremyVoiceMatch: dim,
    helpfulness: dim,
    nonCreepiness: dim,
    notes: { type: "string" },
    flags: { type: "array", items: { type: "string" } },
  },
  required: [
    "specificity",
    "authenticity",
    "brevity",
    "relationshipAccuracy",
    "jeremyVoiceMatch",
    "helpfulness",
    "nonCreepiness",
    "notes",
    "flags",
  ],
};

const SYSTEM = `${MISSION}

${JEREMY_VOICE}

${HUMANITY_STANDARDS}

You are the Humanity Auditor. Grade the reply on each dimension (0-100):
- specificity: is it concrete and grounded, not generic?
- authenticity: does it feel like a real human wrote it?
- brevity: is it as short as it should be for the channel?
- relationshipAccuracy: does it match the actual relationship (no false intimacy,
  no over-naming of memories)?
- jeremyVoiceMatch: does it sound like Jeremy?
- helpfulness: does it move the relationship forward usefully?
- nonCreepiness: does it avoid feeling like surveillance or automation?

In flags, list any dead phrases or red flags you detect (quote them).
Be a strict grader. A single dead phrase ("just checking in", "touching base",
etc.) or any whiff of automation should pull the relevant scores well below 95.`;

/** Weighted overall — nonCreepiness and authenticity carry the most weight. */
function weightedOverall(g: Omit<HumanityGrade, "overall">): number {
  const weights: Record<keyof Omit<HumanityGrade, "overall" | "notes" | "flags">, number> = {
    specificity: 0.15,
    authenticity: 0.2,
    brevity: 0.1,
    relationshipAccuracy: 0.15,
    jeremyVoiceMatch: 0.15,
    helpfulness: 0.1,
    nonCreepiness: 0.15,
  };
  let total = 0;
  for (const [k, w] of Object.entries(weights)) {
    total += (g[k as keyof typeof weights] ?? 0) * w;
  }
  return Math.round(total);
}

export async function auditReply(
  draft: DraftReply,
  snapshot: Snapshot,
): Promise<HumanityGrade> {
  const user = `Relationship context, why they matter: ${snapshot.whyTheyMatter}
Current season: ${snapshot.currentSeason}
Avoid saying: ${snapshot.avoidSaying.join("; ") || "(nothing flagged)"}

Channel: ${draft.channel}
Tone intended: ${draft.tone}

REPLY TO GRADE:
"${draft.text}"`;

  const raw = await structured<Omit<HumanityGrade, "overall">>({
    system: SYSTEM,
    user,
    schema,
    maxTokens: 1500,
    effort: "medium",
  });

  return { ...raw, overall: weightedOverall(raw) };
}
