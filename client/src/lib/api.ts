import type {
  Channel,
  ContactSummary,
  GradedDraft,
  Settings,
  Snapshot,
  SnapshotResult,
} from "./types";

const TOKEN_KEY = "manumation.token";

export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY) ?? "",
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Called when any request returns 401 so the app can drop back to login. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = auth.get();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    auth.clear();
    onUnauthorized?.();
    throw new Error("Your session expired. Please sign in again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface HealthInfo {
  status: string;
  engines: { relationshipEngine: string; ghlConnector: string; database: string };
  auth?: string;
  senderProfile: string;
  humanityThreshold: number;
}

export const api = {
  health: () => req<HealthInfo>("/health"),

  authStatus: () => req<{ authRequired: boolean }>("/api/auth/status"),

  login: (password: string) =>
    req<{ ok: boolean; token: string; authRequired: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

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
