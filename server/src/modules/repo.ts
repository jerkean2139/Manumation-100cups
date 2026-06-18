import { eq, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { env } from "../env.js";
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

/**
 * Resolve the tenant (location) a contact belongs to. v1 is single-tenant: one
 * default location keyed by the configured GHL location id. Returns null only
 * when there's no DB.
 */
export async function resolveLocationId(): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const key = env.ghl.locationId || "default";
  const [existing] = await db
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(eq(schema.locations.ghlLocationId, key))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(schema.locations)
    .values({ ghlLocationId: key, name: env.senderName })
    .onConflictDoNothing()
    .returning({ id: schema.locations.id });
  if (created) return created.id;
  // Lost a race — read it back.
  const [row] = await db
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(eq(schema.locations.ghlLocationId, key))
    .limit(1);
  return row?.id ?? null;
}

export async function upsertContact(ctx: ContactContext): Promise<string | null> {
  const db = getDb();
  if (!db) return null;

  const locationId = await resolveLocationId();

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
      locationId: locationId ?? undefined,
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

function toDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Store the raw GHL history (notes + conversation messages) locally so it lives
 * in our database. Idempotent per contact: clears and re-inserts, so re-syncing
 * never duplicates. Returns how much was stored.
 */
export async function persistRawHistory(
  contactId: string,
  ctx: ContactContext,
): Promise<{ notes: number; conversations: number }> {
  const db = getDb();
  if (!db) return { notes: 0, conversations: 0 };

  await db.delete(schema.contactNotes).where(eq(schema.contactNotes.contactId, contactId));
  if (ctx.notes.length) {
    await db.insert(schema.contactNotes).values(
      ctx.notes.map((n) => ({
        contactId,
        body: n.body,
        createdAt: toDate(n.createdAt),
      })),
    );
  }

  await db
    .delete(schema.conversationEvents)
    .where(eq(schema.conversationEvents.contactId, contactId));
  if (ctx.conversations.length) {
    await db.insert(schema.conversationEvents).values(
      ctx.conversations.map((c) => ({
        contactId,
        direction: c.direction,
        channel: c.channel,
        body: c.body,
        occurredAt: toDate(c.createdAt) ?? new Date(),
      })),
    );
  }

  return { notes: ctx.notes.length, conversations: ctx.conversations.length };
}

/** Read the locally-stored notes + conversation history for a contact. */
export async function getStoredHistory(contactId: string) {
  const db = getDb();
  if (!db) return { notes: [], conversations: [] };
  const notes = await db
    .select()
    .from(schema.contactNotes)
    .where(eq(schema.contactNotes.contactId, contactId))
    .orderBy(desc(schema.contactNotes.createdAt));
  const conversations = await db
    .select()
    .from(schema.conversationEvents)
    .where(eq(schema.conversationEvents.contactId, contactId))
    .orderBy(desc(schema.conversationEvents.occurredAt));
  return { notes, conversations };
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

/** Full locally-stored bundle for a contact, looked up by their GHL id. */
export async function getContactBundleByGhlId(ghlId: string) {
  const db = getDb();
  if (!db) return null;
  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.ghlContactId, ghlId))
    .limit(1);
  if (!contact) return null;

  const { notes, conversations } = await getStoredHistory(contact.id);
  const memories = await db
    .select()
    .from(schema.memories)
    .where(eq(schema.memories.contactId, contact.id))
    .orderBy(desc(schema.memories.createdAt));

  return { contact, notes, conversations, memories };
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

export interface PendingReview {
  key: string;
  contactId: string;
  ghlContactId: string;
  contactName: string;
  inboundMessage: string;
  channel: string;
  createdAt: Date;
  snapshot: {
    scores: Record<string, number>;
    stage: string;
    currentSeason: string;
    bestMemory: string;
    lastMeaningfulMoment: string;
    avoidSaying: string[];
    nextBestConversation: string;
    whyTheyMatter: string;
  } | null;
  drafts: {
    id: string;
    tone: string;
    channel: string;
    text: string;
    grade: Record<string, unknown> | null;
    rewritten: boolean;
  }[];
}

/**
 * Everything awaiting Jeremy's approval — the webhook-built snapshots and their
 * two replies, grouped into review cards. This is what closes the inbound loop:
 * a message comes in, the engines run, and the result lands here for approval.
 */
export async function getPendingReviews(): Promise<PendingReview[]> {
  const db = getDb();
  if (!db) return [];

  const drafts = await db
    .select()
    .from(schema.messageDrafts)
    .where(eq(schema.messageDrafts.status, "pending"))
    .orderBy(desc(schema.messageDrafts.createdAt));
  if (drafts.length === 0) return [];

  const snapshotIds = [
    ...new Set(drafts.map((d) => d.snapshotId).filter((x): x is string => Boolean(x))),
  ];
  const contactIds = [...new Set(drafts.map((d) => d.contactId))];

  const snaps = snapshotIds.length
    ? await db.select().from(schema.snapshots).where(inArray(schema.snapshots.id, snapshotIds))
    : [];
  const conts = await db
    .select()
    .from(schema.contacts)
    .where(inArray(schema.contacts.id, contactIds));

  const snapById = new Map(snaps.map((s) => [s.id, s]));
  const contById = new Map(conts.map((c) => [c.id, c]));

  const groups = new Map<string, PendingReview>();
  for (const d of drafts) {
    const key = d.snapshotId ?? `${d.contactId}:${d.inboundMessage ?? ""}`;
    let group = groups.get(key);
    if (!group) {
      const contact = contById.get(d.contactId);
      const snap = d.snapshotId ? snapById.get(d.snapshotId) : undefined;
      group = {
        key,
        contactId: d.contactId,
        ghlContactId: contact?.ghlContactId ?? d.contactId,
        contactName: contact?.name ?? "Unknown",
        inboundMessage: d.inboundMessage ?? "",
        channel: d.channel,
        createdAt: d.createdAt,
        snapshot: snap
          ? {
              scores: snap.scores,
              stage: snap.stage,
              currentSeason: snap.currentSeason ?? "",
              bestMemory: snap.bestMemory ?? "",
              lastMeaningfulMoment: snap.lastMeaningfulMoment ?? "",
              avoidSaying: snap.avoidSaying ?? [],
              nextBestConversation: snap.nextBestConversation ?? "",
              whyTheyMatter: snap.whyTheyMatter ?? "",
            }
          : null,
        drafts: [],
      };
      groups.set(key, group);
    }
    group.drafts.push({
      id: d.id,
      tone: d.tone,
      channel: d.channel,
      text: d.text,
      grade: d.grade ?? null,
      rewritten: d.rewritten,
    });
  }

  return [...groups.values()];
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
