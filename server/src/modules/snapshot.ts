import { extractMemories } from "./memory-engine.js";
import { buildSnapshot } from "./relationship-engine.js";
import { writeReplies, rewriteReply } from "./voice-engine.js";
import { auditReply } from "./humanity-auditor.js";
import { pullContactContext } from "./ghl-connector.js";
import { getDemoContact } from "./demo-source.js";
import * as repo from "./repo.js";
import { env, hasAnthropic } from "../env.js";
import type {
  Channel,
  ContactContext,
  GradedDraft,
  SnapshotResult,
} from "../types.js";

/**
 * The orchestrator — the full inbound workflow from the spec.
 *
 * 1. Retrieve contact context (GHL, or demo)
 * 2-3. (context already includes notes + memories source)
 * 4. Extract memories          (Memory Engine)
 * 5. Build relationship state  (Relationship Engine)
 * 6. Determine what matters    (snapshot)
 * 7. Generate two replies      (Jeremy Voice Engine)
 * 8. Grade the replies         (Humanity Auditor)
 *    -> rewrite once if below threshold
 * 9. Persist everything for approval
 */

interface ProcessOptions {
  contactId: string;
  inboundMessage: string;
  channel?: Channel;
  /** Force the demo source even if GHL is configured. */
  demo?: boolean;
}

async function resolveContext(opts: ProcessOptions): Promise<ContactContext> {
  if (opts.demo) {
    const demo = getDemoContact(opts.contactId);
    if (demo) return demo;
  }
  // Try the demo source for demo-* ids regardless, so the demo always works.
  const demo = getDemoContact(opts.contactId);
  if (demo) return demo;
  return pullContactContext(opts.contactId);
}

async function gradeAndMaybeRewrite(
  ctx: ContactContext,
  snapshot: SnapshotResult["snapshot"],
  inboundMessage: string,
  draft: { tone: "warm" | "direct"; channel: Channel; text: string },
  threshold: number,
): Promise<GradedDraft> {
  let grade = await auditReply(draft, snapshot);

  if (grade.overall >= threshold) {
    return { ...draft, grade, rewritten: false };
  }

  // The Humanity Auditor rejected it — rewrite once, automatically.
  const feedback = `${grade.notes} Flags: ${grade.flags.join(", ") || "none"}.`;
  const rewrittenText = await rewriteReply(ctx, snapshot, inboundMessage, draft, feedback);
  const rewritten = { ...draft, text: rewrittenText };
  grade = await auditReply(rewritten, snapshot);

  return { ...rewritten, grade, rewritten: true };
}

/**
 * Pull a contact's full history from GHL (or demo) and store it locally:
 * raw notes, conversation messages, and the memories the engine extracts.
 * Used to verify the GHL connection and to keep our "memory" current.
 */
export async function syncContactFromGhl(contactId: string): Promise<{
  contactId: string;
  name: string;
  stored: { notes: number; conversations: number; memories: number };
  source: "demo" | "ghl";
}> {
  const demo = getDemoContact(contactId);
  const ctx = demo ?? (await pullContactContext(contactId));

  const contactRowId = await repo.upsertContact(ctx);
  let storedNotes = 0;
  let storedConversations = 0;
  let storedMemories = 0;

  if (contactRowId) {
    const raw = await repo.persistRawHistory(contactRowId, ctx);
    storedNotes = raw.notes;
    storedConversations = raw.conversations;

    // Extract and store memories from the freshly pulled history (the moat).
    // Notes/conversations are already stored above, so this is best-effort:
    // a missing AI key shouldn't block the raw-history sync.
    if (hasAnthropic()) {
      try {
        const memories = await extractMemories(ctx);
        await repo.saveMemories(contactRowId, memories);
        storedMemories = memories.length;
      } catch (err) {
        console.warn("[sync] memory extraction failed:", (err as Error).message);
      }
    }
  }

  await repo.logAudit("ghl.sync", {
    contactId,
    notes: storedNotes,
    conversations: storedConversations,
    memories: storedMemories,
  });

  return {
    contactId: ctx.ghlContactId,
    name: ctx.name,
    stored: { notes: storedNotes, conversations: storedConversations, memories: storedMemories },
    source: demo ? "demo" : "ghl",
  };
}

export async function processInbound(opts: ProcessOptions): Promise<SnapshotResult> {
  const channel = opts.channel ?? "inbox";
  const ctx = await resolveContext(opts);

  const settings = await repo.getSettings();
  const threshold = settings.humanityThreshold ?? env.humanityThreshold;

  // Memory Engine + Relationship Engine.
  const memories = await extractMemories(ctx);
  const snapshot = await buildSnapshot(ctx, memories);

  // Jeremy Voice Engine — two options.
  const replies = await writeReplies(ctx, snapshot, opts.inboundMessage, channel);

  // Humanity Auditor — grade both in parallel, rewriting any that fall short.
  const drafts: GradedDraft[] = await Promise.all(
    replies.map((reply) =>
      gradeAndMaybeRewrite(ctx, snapshot, opts.inboundMessage, reply, threshold),
    ),
  );

  // Persist for approval (no-ops without a database).
  const contactRowId = await repo.upsertContact(ctx);
  if (contactRowId) {
    // Store the raw GHL history locally so it lives in our memory, not just GHL's.
    await repo.persistRawHistory(contactRowId, ctx);
    await repo.saveMemories(contactRowId, memories);
    const snapshotId = await repo.saveSnapshot(contactRowId, snapshot);
    await repo.saveDrafts(contactRowId, snapshotId, opts.inboundMessage, drafts);
    await repo.logAudit(
      "snapshot.build",
      { channel, inboundMessage: opts.inboundMessage, memoryCount: memories.length },
      contactRowId,
    );
  }

  return {
    contactId: ctx.ghlContactId,
    inboundMessage: opts.inboundMessage,
    snapshot,
    memories,
    drafts,
  };
}
