import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { env, hasAnthropic, hasGhl, authEnabled } from "../env.js";
import { requireAuth, checkPassword, issueToken } from "../auth.js";
import { hasDb } from "../db/index.js";
import { processInbound } from "../modules/snapshot.js";
import { writeReplies } from "../modules/voice-engine.js";
import { auditReply } from "../modules/humanity-auditor.js";
import { buildSnapshot } from "../modules/relationship-engine.js";
import { extractMemories } from "../modules/memory-engine.js";
import { sendMessage, createNote, pullContactContext } from "../modules/ghl-connector.js";
import { getDemoContact, listDemoContacts } from "../modules/demo-source.js";
import * as repo from "../modules/repo.js";
import type { Channel } from "../types.js";

export const router = Router();

const asyncH =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    fn(req, res).catch((err: Error) => {
      console.error(`[api] ${req.method} ${req.path} ->`, err.message);
      res.status(500).json({ error: err.message });
    });
  };

// ── Health ──────────────────────────────────────────────────────────────
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "manumation-snapshot",
    version: "1.0.0",
    engines: {
      relationshipEngine: hasAnthropic() ? "online" : "offline (no ANTHROPIC_API_KEY)",
      ghlConnector: hasGhl() ? "connected" : "offline (no GHL token)",
      database: hasDb() ? "connected" : "offline (no DATABASE_URL)",
    },
    auth: authEnabled() ? "enabled" : "open",
    senderProfile: env.senderName,
    humanityThreshold: env.humanityThreshold,
  });
});

// ── Inbound webhook (GHL → middleware) ──────────────────────────────────
router.post(
  "/webhooks/ghl/inbound-message",
  asyncH(async (req, res) => {
    // Optional shared-secret check.
    if (env.ghl.webhookSecret) {
      const provided = req.header("x-ghl-secret") ?? req.query.secret;
      if (provided !== env.ghl.webhookSecret) {
        return res.status(401).json({ error: "Invalid webhook secret." });
      }
    }

    const body = req.body ?? {};
    const contactId = body.contactId ?? body.contact_id ?? body.contact?.id;
    const message =
      body.message?.body ?? body.body ?? body.message ?? body.text ?? "";
    const channel = (body.channel ?? body.messageType ?? "inbox") as string;

    if (!contactId || !message) {
      return res.status(400).json({ error: "contactId and message are required." });
    }

    const result = await processInbound({
      contactId: String(contactId),
      inboundMessage: String(message),
      channel: normalizeChannel(channel),
    });

    res.json({ ok: true, result });
  }),
);

// ── Auth (public) ─────────────────────────────────────────────────────────
router.get("/api/auth/status", (_req, res) => {
  res.json({ authRequired: authEnabled() });
});

router.post(
  "/api/auth/login",
  asyncH(async (req, res) => {
    if (!authEnabled()) {
      // No password configured — hand back a token so the client proceeds.
      return res.json({ ok: true, token: issueToken(), authRequired: false });
    }
    const password = z.string().min(1).safeParse(req.body?.password);
    if (!password.success || !checkPassword(password.data)) {
      return res.status(401).json({ error: "Incorrect password." });
    }
    res.json({ ok: true, token: issueToken(), authRequired: true });
  }),
);

// ── Everything below requires a valid session (no-op when auth is disabled) ──
// Public surfaces above this line: /health, the GHL webhook (own secret), and
// the two /api/auth endpoints.
router.use("/api", requireAuth);

// ── Build a snapshot on demand ───────────────────────────────────────────
const buildSchema = z.object({
  contactId: z.string().min(1),
  inboundMessage: z.string().min(1),
  channel: z.enum(["sms", "email", "inbox"]).optional(),
  demo: z.boolean().optional(),
});

router.post(
  "/api/snapshot/build",
  asyncH(async (req, res) => {
    const parsed = buildSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const result = await processInbound(parsed.data);
    res.json(result);
  }),
);

// ── Regenerate one draft ─────────────────────────────────────────────────
const regenSchema = z.object({
  contactId: z.string().min(1),
  inboundMessage: z.string().min(1),
  channel: z.enum(["sms", "email", "inbox"]).optional(),
  tone: z.enum(["warm", "direct"]).optional(),
});

router.post(
  "/api/drafts/regenerate",
  asyncH(async (req, res) => {
    const parsed = regenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { contactId, inboundMessage } = parsed.data;
    const channel = parsed.data.channel ?? "inbox";

    const ctx = getDemoContact(contactId) ?? (await pullContactContext(contactId));
    const memories = await extractMemories(ctx);
    const snapshot = await buildSnapshot(ctx, memories);
    const replies = await writeReplies(ctx, snapshot, inboundMessage, channel);

    const chosen = parsed.data.tone
      ? replies.filter((r) => r.tone === parsed.data.tone)
      : replies;

    const graded = [];
    for (const reply of chosen) {
      const grade = await auditReply(reply, snapshot);
      graded.push({ ...reply, grade, rewritten: false });
    }

    res.json({ snapshot, drafts: graded });
  }),
);

// ── Approve a draft (and send through GHL) ───────────────────────────────
const approveSchema = z.object({
  draftId: z.string().optional(),
  contactId: z.string().min(1),
  channel: z.enum(["sms", "email", "inbox"]).optional(),
  text: z.string().min(1),
  send: z.boolean().optional(),
});

router.post(
  "/api/drafts/approve",
  asyncH(async (req, res) => {
    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { draftId, contactId, text } = parsed.data;
    const channel = parsed.data.channel ?? "inbox";

    if (draftId) await repo.setDraftStatus(draftId, "approved");

    let sent = false;
    if (parsed.data.send !== false) {
      sent = await sendMessage(contactId, channel, text);
      if (sent && draftId) await repo.setDraftStatus(draftId, "sent");
    }

    await repo.logAudit("draft.approve", { draftId, channel, sent });
    res.json({ ok: true, sent, ghlConfigured: hasGhl() });
  }),
);

router.post(
  "/api/drafts/delete",
  asyncH(async (req, res) => {
    const draftId = z.string().parse(req.body?.draftId);
    await repo.setDraftStatus(draftId, "deleted");
    res.json({ ok: true });
  }),
);

// ── Save a memory (PostgreSQL + GHL note) ────────────────────────────────
const memorySchema = z.object({
  contactId: z.string().min(1),
  type: z.string().min(1),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
});

router.post(
  "/api/memories/save",
  asyncH(async (req, res) => {
    const parsed = memorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { contactId, type, content } = parsed.data;

    // Persist locally if we have a contact row.
    const ctx = getDemoContact(contactId);
    if (ctx) {
      const rowId = await repo.upsertContact(ctx);
      if (rowId) {
        await repo.saveMemories(
          rowId,
          [{ type: type as never, content, confidence: parsed.data.confidence ?? 1 }],
          "user",
        );
      }
    }

    // Mirror to GHL as a note so the memory lives where the user works.
    const noteSaved = await createNote(contactId, `[Memory · ${type}] ${content}`);

    await repo.logAudit("memory.save", { contactId, type, noteSaved });
    res.json({ ok: true, ghlNoteSaved: noteSaved });
  }),
);

// ── Contact snapshot (profile + history) ─────────────────────────────────
router.get(
  "/api/contact/:id",
  asyncH(async (req, res) => {
    const id = req.params.id;

    // Demo contacts resolve directly.
    const demo = getDemoContact(id);
    if (demo) {
      return res.json({ source: "demo", contact: demo });
    }

    const stored = await repo.getContactWithHistory(id);
    if (stored) {
      return res.json({ source: "db", ...stored });
    }

    // Fall back to a live GHL pull.
    if (hasGhl()) {
      const ctx = await pullContactContext(id);
      return res.json({ source: "ghl", contact: ctx });
    }

    res.status(404).json({ error: "Contact not found." });
  }),
);

// ── Demo contacts (for the UI to list something on day one) ──────────────
router.get("/api/contacts", (_req, res) => {
  res.json({
    contacts: listDemoContacts().map((c) => ({
      id: c.ghlContactId,
      name: c.name,
      email: c.email,
      tags: c.tags,
    })),
  });
});

// ── Settings ─────────────────────────────────────────────────────────────
router.get(
  "/api/settings",
  asyncH(async (_req, res) => {
    res.json(await repo.getSettings());
  }),
);

const settingsSchema = z.object({
  autoSms: z.boolean().optional(),
  autoEmail: z.boolean().optional(),
  autoInbox: z.boolean().optional(),
  autoVoicemail: z.boolean().optional(),
  humanityThreshold: z.number().int().min(0).max(100).optional(),
  senderName: z.string().optional(),
});

router.post(
  "/api/settings",
  asyncH(async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    res.json(await repo.updateSettings(parsed.data));
  }),
);

function normalizeChannel(raw: string): Channel {
  const t = raw.toLowerCase();
  if (t.includes("sms") || t.includes("phone")) return "sms";
  if (t.includes("email")) return "email";
  return "inbox";
}
