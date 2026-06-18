import { useEffect, useState } from "react";
import { Send, BookmarkPlus } from "lucide-react";
import { api } from "../lib/api";
import type { Channel, ContactSummary, GradedDraft, SnapshotResult } from "../lib/types";
import { Card, CardSection, Button, Badge, Spinner } from "../components/ui";
import { SnapshotView } from "../components/SnapshotView";
import { DraftCard } from "../components/DraftCard";

const CHANNELS: Channel[] = ["inbox", "sms", "email"];

export default function InboxAssistant() {
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [contactId, setContactId] = useState("");
  const [channel, setChannel] = useState<Channel>("inbox");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SnapshotResult | null>(null);
  const [drafts, setDrafts] = useState<GradedDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [threshold, setThreshold] = useState(95);

  useEffect(() => {
    api.contacts().then((r) => {
      setContacts(r.contacts);
      if (r.contacts[0]) setContactId(r.contacts[0].id);
    });
    api.health().then((h) => setThreshold(h.humanityThreshold)).catch(() => {});
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  async function build() {
    if (!contactId || !message.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await api.buildSnapshot({ contactId, inboundMessage: message, channel });
      setResult(r);
      setDrafts(r.drafts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function approve(text: string) {
    setBusy(true);
    try {
      const r = await api.approve({ contactId, text, channel });
      notify(r.sent ? "Sent through GHL." : "Approved (GHL not connected — not sent).");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(tone: "warm" | "direct") {
    setBusy(true);
    try {
      const r = await api.regenerate({ contactId, inboundMessage: message, channel, tone });
      setDrafts((prev) =>
        prev.map((d) => (d.tone === tone ? r.drafts.find((x) => x.tone === tone) ?? d : d)),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMemory() {
    if (!result) return;
    setBusy(true);
    try {
      // Save the highest-confidence memory the engine surfaced.
      const top = [...result.memories].sort((a, b) => b.confidence - a.confidence)[0];
      if (!top) return notify("No memory to save.");
      const r = await api.saveMemory({ contactId, type: top.type, content: top.content });
      notify(r.ghlNoteSaved ? "Memory saved to GHL note." : "Memory saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink">Inbox Assistant</h1>
        <p className="mt-1 text-muted">
          A message came in. Here's what matters about this person — and how to reply
          like you remembered.
        </p>
      </header>

      <Card>
        <CardSection>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Contact
              </span>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-sand bg-canvas px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Channel
              </span>
              <div className="mt-1 flex gap-2">
                {CHANNELS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={
                      "flex-1 rounded-xl border px-3 py-2 text-sm capitalize " +
                      (channel === c
                        ? "border-ink bg-ink text-canvas"
                        : "border-sand bg-canvas text-muted hover:bg-sand")
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Inbound message
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Paste what they just said…"
              className="mt-1 w-full rounded-xl border border-sand bg-canvas p-3 text-sm text-ink focus:border-ink focus:outline-none"
            />
          </label>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted">
              Replies must score ≥ {threshold} on Humanity, or they're rewritten.
            </span>
            <Button onClick={build} disabled={loading || !message.trim()}>
              <Send className="h-4 w-4" />
              {loading ? "Thinking…" : "Build Snapshot"}
            </Button>
          </div>
        </CardSection>
      </Card>

      {error && (
        <div className="mt-4 rounded-xl border border-clay/40 bg-clay/5 p-3 text-sm text-clay">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-8 flex justify-center">
          <Spinner label="Remembering what matters about this person…" />
        </div>
      )}

      {result && !loading && (
        <div className="mt-8 space-y-6">
          <SnapshotView snapshot={result.snapshot} />

          {result.memories.length > 0 && (
            <Card>
              <CardSection title="Memories in play">
                <div className="flex flex-wrap gap-2">
                  {result.memories.map((m, i) => (
                    <Badge key={i} className="bg-canvas border border-sand">
                      <span className="text-clay mr-1">{m.type}</span> {m.content}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3">
                  <Button variant="outline" onClick={saveMemory} disabled={busy}>
                    <BookmarkPlus className="h-4 w-4" /> Save top memory
                  </Button>
                </div>
              </CardSection>
            </Card>
          )}

          <div>
            <h2 className="mb-3 font-serif text-xl text-ink">Suggested replies</h2>
            <div className="space-y-4">
              {drafts.map((d) => (
                <DraftCard
                  key={d.tone}
                  draft={d}
                  threshold={threshold}
                  busy={busy}
                  onApprove={approve}
                  onRegenerate={() => regenerate(d.tone)}
                  onDelete={() =>
                    setDrafts((prev) => prev.filter((x) => x.tone !== d.tone))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-ink px-4 py-2 text-sm text-canvas shadow-soft">
          {toast}
        </div>
      )}
    </div>
  );
}
