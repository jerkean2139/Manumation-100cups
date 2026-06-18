import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * The seven core tables from the technical spec, plus a tenant-ready
 * `locations` table.
 *
 * Relationship intelligence is stored as structured JSON where it is read
 * as a whole (snapshots, scores), and as rows where it is queried/filtered
 * (memories, events, drafts).
 *
 * TENANCY: v1 is functionally single-tenant (one Jeremy, one location), but
 * every contact is scoped to a `location` keyed by GHL's `locationId`. This is
 * exactly GHL's structure (Agency → Locations/sub-accounts → Contacts), so
 * growing into a multi-tenant marketplace app later is additive — add OAuth and
 * onboarding, not a schema migration.
 */

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** GHL location (sub-account) id. "default" for the single-tenant v1. */
    ghlLocationId: text("ghl_location_id").notNull().unique(),
    name: text("name"),
    /** Per-location GHL token (used once multi-tenant OAuth lands; null in v1). */
    ghlAccessToken: text("ghl_access_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "cascade",
    }),
    ghlContactId: text("ghl_contact_id").notNull().unique(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    customFields: jsonb("custom_fields")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ghlIdx: index("contacts_ghl_idx").on(t.ghlContactId),
    locationIdx: index("contacts_location_idx").on(t.locationId),
  }),
);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    content: text("content").notNull(),
    confidence: real("confidence").default(0.7).notNull(),
    source: text("source"),
    /** Where the memory came from: "engine" (AI-extracted) or "user" (saved). */
    origin: text("origin").default("engine").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    contactIdx: index("memories_contact_idx").on(t.contactId),
  }),
);

export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    scores: jsonb("scores").$type<Record<string, number>>().notNull(),
    stage: text("stage").notNull(),
    currentSeason: text("current_season"),
    bestMemory: text("best_memory"),
    lastMeaningfulMoment: text("last_meaningful_moment"),
    avoidSaying: jsonb("avoid_saying").$type<string[]>().default([]).notNull(),
    nextBestConversation: text("next_best_conversation"),
    whyTheyMatter: text("why_they_matter"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    contactIdx: index("snapshots_contact_idx").on(t.contactId),
  }),
);

export const messageDrafts = pgTable(
  "message_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id").references(() => snapshots.id, {
      onDelete: "set null",
    }),
    channel: text("channel").notNull(),
    tone: text("tone").notNull(),
    text: text("text").notNull(),
    grade: jsonb("grade").$type<Record<string, unknown>>(),
    rewritten: boolean("rewritten").default(false).notNull(),
    /** pending | approved | sent | deleted */
    status: text("status").default("pending").notNull(),
    inboundMessage: text("inbound_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    contactIdx: index("drafts_contact_idx").on(t.contactId),
    statusIdx: index("drafts_status_idx").on(t.status),
  }),
);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  autoSms: boolean("auto_sms").default(false).notNull(),
  autoEmail: boolean("auto_email").default(false).notNull(),
  autoInbox: boolean("auto_inbox").default(false).notNull(),
  autoVoicemail: boolean("auto_voicemail").default(false).notNull(),
  humanityThreshold: integer("humanity_threshold").default(95).notNull(),
  senderName: text("sender_name").default("Jeremy Kean").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    /** e.g. snapshot.build, draft.approve, humanity.reject, ghl.send */
    action: text("action").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    actionIdx: index("audit_action_idx").on(t.action),
  }),
);

export const conversationEvents = pgTable(
  "conversation_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(), // inbound | outbound
    channel: text("channel").notNull(),
    body: text("body").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    contactIdx: index("events_contact_idx").on(t.contactId),
  }),
);

/**
 * Raw GHL notes, pulled and stored locally so the relationship history lives
 * here ("client memory") and the Memory Engine doesn't depend on a live GHL
 * round-trip every time.
 */
export const contactNotes = pgTable(
  "contact_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    ghlNoteId: text("ghl_note_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    contactIdx: index("notes_contact_idx").on(t.contactId),
  }),
);

export type LocationRow = typeof locations.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type MemoryRow = typeof memories.$inferSelect;
export type SnapshotRow = typeof snapshots.$inferSelect;
export type DraftRow = typeof messageDrafts.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;
