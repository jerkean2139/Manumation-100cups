import { env, hasGhl } from "../env.js";
import type { Channel, ContactContext } from "../types.js";

/**
 * MODULE 1 — The GHL Connector.
 *
 * Talks to Go High Level (LeadConnector API) using a private integration token
 * (v1). Pulls contact, notes, conversations, and custom fields; pushes approved
 * messages and creates notes.
 *
 * Network/response shapes vary across GHL accounts, so every fetch is defensive:
 * a failed sub-resource degrades gracefully (empty list) rather than failing the
 * whole snapshot. When GHL isn't configured, callers should use the demo source.
 */

const API_VERSION = "2021-07-28";

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.ghl.apiToken}`,
    Version: API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function ghlFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${env.ghl.apiBase}${path}`, {
      ...init,
      headers: { ...headers(), ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      console.warn(`[ghl] ${path} -> ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[ghl] ${path} failed:`, (err as Error).message);
    return null;
  }
}

interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: { id?: string; key?: string; value?: string; field_value?: string }[];
}

function mapChannel(raw?: string): Channel {
  const t = (raw ?? "").toLowerCase();
  if (t.includes("sms") || t.includes("phone")) return "sms";
  if (t.includes("email")) return "email";
  return "inbox";
}

/** Pull and normalize everything we know about a contact from GHL. */
export async function pullContactContext(contactId: string): Promise<ContactContext> {
  if (!hasGhl()) {
    throw new Error("GHL is not configured (GHL_API_TOKEN / GHL_LOCATION_ID).");
  }

  const contactRes = await ghlFetch<{ contact: GhlContact }>(`/contacts/${contactId}`);
  const c = contactRes?.contact;
  if (!c) {
    throw new Error(`GHL contact ${contactId} not found.`);
  }

  const name =
    c.name?.trim() ||
    [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
    "Unknown";

  const customFields: Record<string, string> = {};
  for (const f of c.customFields ?? []) {
    const key = f.key ?? f.id;
    const value = f.value ?? f.field_value;
    if (key && value) customFields[key] = value;
  }

  // Notes
  const notesRes = await ghlFetch<{ notes: { body: string; dateAdded?: string }[] }>(
    `/contacts/${contactId}/notes`,
  );
  const notes = (notesRes?.notes ?? []).map((n) => ({
    body: n.body,
    createdAt: n.dateAdded,
  }));

  // Conversations -> messages
  const conversations: ContactContext["conversations"] = [];
  const convRes = await ghlFetch<{ conversations: { id: string }[] }>(
    `/conversations/search?locationId=${env.ghl.locationId}&contactId=${contactId}`,
  );
  for (const conv of (convRes?.conversations ?? []).slice(0, 5)) {
    const msgRes = await ghlFetch<{
      messages: { messages: { direction?: string; messageType?: string; body?: string; dateAdded?: string }[] };
    }>(`/conversations/${conv.id}/messages`);
    const messages = msgRes?.messages?.messages ?? [];
    for (const m of messages) {
      if (!m.body) continue;
      conversations.push({
        direction: m.direction === "outbound" ? "outbound" : "inbound",
        channel: mapChannel(m.messageType),
        body: m.body,
        createdAt: m.dateAdded,
      });
    }
  }

  console.log(
    `[ghl] pulled contact ${contactId}: notes=${notes.length} conversations=${conversations.length} fields=${Object.keys(customFields).length}`,
  );

  return {
    ghlContactId: c.id,
    name,
    email: c.email,
    phone: c.phone,
    tags: c.tags ?? [],
    notes,
    conversations,
    customFields,
  };
}

/** Send an approved reply back through GHL. */
export async function sendMessage(
  contactId: string,
  channel: Channel,
  text: string,
): Promise<boolean> {
  if (!hasGhl()) {
    console.warn("[ghl] sendMessage skipped — GHL not configured.");
    return false;
  }
  const type = channel === "email" ? "Email" : channel === "sms" ? "SMS" : "Live_Chat";
  const res = await ghlFetch<{ messageId?: string }>("/conversations/messages", {
    method: "POST",
    body: JSON.stringify({ type, contactId, message: text }),
  });
  return Boolean(res);
}

/** Persist a memory back into GHL as a contact note. */
export async function createNote(contactId: string, body: string): Promise<boolean> {
  if (!hasGhl()) return false;
  const res = await ghlFetch<{ note?: unknown }>(`/contacts/${contactId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return Boolean(res);
}

export { hasGhl };
