import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { ContactSummary } from "../lib/types";
import { Card, CardSection, Badge, Spinner } from "../components/ui";

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

  useEffect(() => {
    api.contacts().then((r) => {
      setContacts(r.contacts);
      if (!selected && r.contacts[0]) setSelected(r.contacts[0].id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api
      .contact(selected)
      .then((r) => {
        const c = (r.contact as ContactContext) ?? null;
        setContact(c);
        setMemories((r.memories as StoredMemory[]) ?? []);
      })
      .catch(() => setContact(null))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-ink">Contact Snapshot</h1>
          <p className="mt-1 text-muted">The full relationship profile and history.</p>
        </div>
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
      </header>

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
                      <span className="text-clay">{m.type}</span> — {m.content}
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
