import type {
  Channel,
  ContactSummary,
  GradedDraft,
  Settings,
  Snapshot,
  SnapshotResult,
} from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface HealthInfo {
  status: string;
  engines: { relationshipEngine: string; ghlConnector: string; database: string };
  senderProfile: string;
  humanityThreshold: number;
}

export const api = {
  health: () => req<HealthInfo>("/health"),

  contacts: () => req<{ contacts: ContactSummary[] }>("/api/contacts"),

  buildSnapshot: (input: {
    contactId: string;
    inboundMessage: string;
    channel?: Channel;
  }) =>
    req<SnapshotResult>("/api/snapshot/build", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  regenerate: (input: {
    contactId: string;
    inboundMessage: string;
    channel?: Channel;
    tone?: "warm" | "direct";
  }) =>
    req<{ snapshot: Snapshot; drafts: GradedDraft[] }>("/api/drafts/regenerate", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  approve: (input: {
    contactId: string;
    text: string;
    channel?: Channel;
    send?: boolean;
  }) =>
    req<{ ok: boolean; sent: boolean; ghlConfigured: boolean }>("/api/drafts/approve", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  saveMemory: (input: { contactId: string; type: string; content: string }) =>
    req<{ ok: boolean; ghlNoteSaved: boolean }>("/api/memories/save", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  contact: (id: string) =>
    req<{ source: string; contact?: unknown; memories?: unknown[] }>(
      `/api/contact/${encodeURIComponent(id)}`,
    ),

  getSettings: () => req<Settings>("/api/settings"),

  updateSettings: (patch: Partial<Settings>) =>
    req<Settings>("/api/settings", {
      method: "POST",
      body: JSON.stringify(patch),
    }),
};
