import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type {
  ContactContext,
  ExtractedMemory,
  GradedDraft,
  Snapshot,
} from "../types.js";

/**
 * Persistence helpers.
 *
 * All functions degrade gracefully when DATABASE_URL is unset: they return null
 * / empty so the relationship-intelligence flow still works in demo mode.
 */

export async function upsertContact(ctx: ContactContext): Promise<string | null> {
  const db = getDb();
  if (!db) return null;

  const [existing] = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.ghlContactId, ctx.ghlContactId))
    .limit(1);

  if (existing) {
    await db
      .update(schema.contacts)
      .set({
        name: ctx.name,
        email: ctx.email,
        phone: ctx.phone,
        tags: ctx.tags,
        customFields: ctx.customFields,
        updatedAt: new Date(),
      })
      .where(eq(schema.contacts.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(schema.contacts)
    .values({
      ghlContactId: ctx.ghlContactId,
      name: ctx.name,
      email: ctx.email,
      phone: ctx.phone,
      tags: ctx.tags,
      customFields: ctx.customFields,
    })
    .returning({ id: schema.contacts.id });
  return created?.id ?? null;
}

export async function saveMemories(
  contactId: string,
  memories: ExtractedMemory[],
  origin: "engine" | "user" = "engine",
): Promise<void> {
  const db = getDb();
  if (!db || memories.length === 0) return;
  await db.insert(schema.memories).values(
    memories.map((m) => ({
      contactId,
      type: m.type,
      content: m.content,
      confidence: m.confidence,
      source: m.source,
      origin,
    })),
  );
}

export async function saveSnapshot(
  contactId: string,
  snapshot: Snapshot,
): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .insert(schema.snapshots)
    .values({
      contactId,
      scores: snapshot.scores as unknown as Record<string, number>,
      stage: snapshot.stage,
      currentSeason: snapshot.currentSeason,
      bestMemory: snapshot.bestMemory,
      lastMeaningfulMoment: snapshot.lastMeaningfulMoment,
      avoidSaying: snapshot.avoidSaying,
      nextBestConversation: snapshot.nextBestConversation,
      whyTheyMatter: snapshot.whyTheyMatter,
    })
    .returning({ id: schema.snapshots.id });
  return row?.id ?? null;
}

export async function saveDrafts(
  contactId: string,
  snapshotId: string | null,
  inboundMessage: string,
  drafts: GradedDraft[],
): Promise<void> {
  const db = getDb();
  if (!db || drafts.length === 0) return;
  await db.insert(schema.messageDrafts).values(
    drafts.map((d) => ({
      contactId,
      snapshotId: snapshotId ?? undefined,
      channel: d.channel,
      tone: d.tone,
      text: d.text,
      grade: d.grade as unknown as Record<string, unknown>,
      rewritten: d.rewritten,
      inboundMessage,
      status: "pending" as const,
    })),
  );
}

export async function logAudit(
  action: string,
  detail: Record<string, unknown>,
  contactId?: string,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.insert(schema.auditLogs).values({ action, detail, contactId });
}

export async function getContactWithHistory(contactId: string) {
  const db = getDb();
  if (!db) return null;
  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, contactId))
    .limit(1);
  if (!contact) return null;

  const memories = await db
    .select()
    .from(schema.memories)
    .where(eq(schema.memories.contactId, contactId))
    .orderBy(desc(schema.memories.createdAt));

  const snaps = await db
    .select()
    .from(schema.snapshots)
    .where(eq(schema.snapshots.contactId, contactId))
    .orderBy(desc(schema.snapshots.createdAt));

  const drafts = await db
    .select()
    .from(schema.messageDrafts)
    .where(eq(schema.messageDrafts.contactId, contactId))
    .orderBy(desc(schema.messageDrafts.createdAt));

  return { contact, memories, snapshots: snaps, drafts };
}

export async function setDraftStatus(
  draftId: string,
  status: "approved" | "sent" | "deleted",
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .update(schema.messageDrafts)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.messageDrafts.id, draftId));
}

export async function getDraft(draftId: string) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(schema.messageDrafts)
    .where(eq(schema.messageDrafts.id, draftId))
    .limit(1);
  return row ?? null;
}

const DEFAULT_SETTINGS = {
  id: 1,
  autoSms: false,
  autoEmail: false,
  autoInbox: false,
  autoVoicemail: false,
  humanityThreshold: 95,
  senderName: "Jeremy Kean",
};

export async function getSettings() {
  const db = getDb();
  if (!db) return DEFAULT_SETTINGS;
  const [row] = await db.select().from(schema.settings).limit(1);
  if (!row) {
    await db.insert(schema.settings).values(DEFAULT_SETTINGS).onConflictDoNothing();
    return DEFAULT_SETTINGS;
  }
  return row;
}

export async function updateSettings(
  patch: Partial<typeof DEFAULT_SETTINGS>,
): Promise<typeof DEFAULT_SETTINGS> {
  const db = getDb();
  if (!db) return { ...DEFAULT_SETTINGS, ...patch };
  await db
    .insert(schema.settings)
    .values({ ...DEFAULT_SETTINGS, ...patch, id: 1 })
    .onConflictDoUpdate({
      target: schema.settings.id,
      set: { ...patch, updatedAt: new Date() },
    });
  const [row] = await db.select().from(schema.settings).limit(1);
  return row ?? { ...DEFAULT_SETTINGS, ...patch };
}
