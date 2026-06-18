import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import type { ContactSummary } from "../lib/types";
import { Card, CardSection, Badge, Button, Spinner } from "../components/ui";

interface ContactContext {
  ghlContactId: string;
  name: string;
  email?: string;
  phone?: string;
  tags: string[];
  notes: { body: string; createdAt?: string }[];
  conversations: { direction: string; channel: string; body: string; createdAt?: string }[];
  customFields: Record<string, string>;
}

interface StoredMemory {
  type: string;
  content: string;
  confidence: number;
}

export default function ContactSnapshot() {
  const { id } = useParams();
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [selected, setSelected] = useState(id ?? "");
  const [contact, setContact] = useState<ContactContext | null>(null);
  const [memories, setMemories] = useState<StoredMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState("");
  const [syncId, setSyncId] = useState("");

  function loadContacts(selectId?: string) {
    return api.contacts().then((r) => {
      setContacts(r.contacts);
      if (selectId) setSelected(selectId);
      else if (!selected && r.contacts[0]) setSelected(r.contacts[0].id);
    });
  }

  useEffect(() => {
    loadContacts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function syncById() {
    const id = syncId.trim();
    if (!id) return;
    setSyncing(true);
    setToast("");
    try {
      const r = await api.syncContact(id);
      setToast(
        `Pulled ${r.name} from ${r.source === "ghl" ? "GHL" : "demo"}: ${r.stored.notes} notes, ${r.stored.conversations} messages, ${r.stored.memories} memories.`,
      );
      setSyncId("");
      await loadContacts(id);
      load(id);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(""), 6000);
    }
  }

  function load(id: string) {
    if (!id) return;
    setLoading(true);
    api
      .contact(id)
      .then((r) => {
        setContact((r.contact as ContactContext) ?? null);
        setMemories((r.memories as StoredMemory[]) ?? []);
      })
      .catch(() => setContact(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(selected);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sync() {
    if (!selected) return;
    setSyncing(true);
    setToast("");
    try {
      const r = await api.syncContact(selected);
      setToast(
        `Pulled from ${r.source === "ghl" ? "GHL" : "demo"}: ${r.stored.notes} notes, ${r.stored.conversations} messages, ${r.stored.memories} memories stored.`,
      );
      load(selected);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(""), 5000);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-ink">Contact Snapshot</h1>
          <p className="mt-1 text-muted">The full relationship profile and history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={sync} disabled={syncing || !selected}>
            <RefreshCw className="h-4 w-4" /> {syncing ? "Syncing…" : "Sync from GHL"}
          </Button>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-xl border border-sand bg-canvas px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {toast && (
        <div className="mb-4 rounded-xl border border-sand bg-paper p-3 text-sm text-ink shadow-soft">
          {toast}
        </div>
      )}

      <Card className="mb-4">
        <CardSection>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Pull a GHL contact by ID
              </span>
              <input
                value={syncId}
                onChange={(e) => setSyncId(e.target.value)}
                placeholder="GHL contact id"
                className="mt-1 w-full rounded-xl border border-sand bg-canvas px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
              />
            </label>
            <Button onClick={syncById} disabled={syncing || !syncId.trim()}>
              <RefreshCw className="h-4 w-4" /> {syncing ? "Pulling…" : "Pull & store"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Pulls that contact's notes and conversation history from GHL into local
            memory, then adds them to the list above. Requires GHL to be connected.
          </p>
        </CardSection>
      </Card>

      {loading && <Spinner label="Loading relationship…" />}

      {contact && !loading && (
        <div className="space-y-4">
          <Card>
            <CardSection>
              <h2 className="font-serif text-2xl text-ink">{contact.name}</h2>
              <div className="mt-1 text-sm text-muted">
                {[contact.email, contact.phone].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {contact.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              {Object.keys(contact.customFields ?? {}).length > 0 && (
                <div className="mt-3 text-sm text-muted">
                  {Object.entries(contact.customFields).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-ink">{k}:</span> {v}
                    </div>
                  ))}
                </div>
              )}
            </CardSection>
          </Card>

          {memories.length > 0 && (
            <Card>
              <CardSection title="Memory history">
                <ul className="space-y-2">
                  {memories.map((m, i) => (
                    <li key={i} className="text-sm text-ink">
                      <span className="text-clay">{m.type}</span>: {m.content}
                    </li>
                  ))}
                </ul>
              </CardSection>
            </Card>
          )}

          {contact.notes?.length > 0 && (
            <Card>
              <CardSection title="Notes">
                <ul className="space-y-3">
                  {contact.notes.map((n, i) => (
                    <li key={i} className="text-sm leading-relaxed text-ink">
                      {n.body}
                      {n.createdAt && (
                        <span className="ml-2 text-xs text-muted">{n.createdAt}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardSection>
            </Card>
          )}

          {contact.conversations?.length > 0 && (
            <Card>
              <CardSection title="Conversation timeline">
                <ul className="space-y-2">
                  {contact.conversations.map((c, i) => (
                    <li
                      key={i}
                      className={
                        "rounded-xl px-3 py-2 text-sm " +
                        (c.direction === "inbound"
                          ? "bg-sand text-ink"
                          : "bg-ink/5 text-ink")
                      }
                    >
                      <span className="text-xs uppercase tracking-wider text-muted">
                        {c.direction === "inbound" ? contact.name : "Jeremy"} · {c.channel}
                      </span>
                      <div>{c.body}</div>
                    </li>
                  ))}
                </ul>
              </CardSection>
            </Card>
          )}
        </div>
      )}

      {!contact && !loading && (
        <p className="text-sm text-muted">Select a contact to see their snapshot.</p>
      )}
    </div>
  );
}
