import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleDot } from "lucide-react";
import { api, type HealthInfo } from "../lib/api";
import type { ContactSummary } from "../lib/types";
import { Card, CardSection, Badge } from "../components/ui";
import { cn } from "../lib/utils";

function StatusDot({ value }: { value: string }) {
  const ok = value.includes("online") || value.includes("connected");
  return (
    <span className="flex items-center gap-2 text-sm">
      <CircleDot className={cn("h-3.5 w-3.5", ok ? "text-sage" : "text-clay")} />
      <span className="text-ink">{value}</span>
    </span>
  );
}

export default function Dashboard() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api.contacts().then((r) => setContacts(r.contacts));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink">Dashboard</h1>
        <p className="mt-1 text-muted">
          GHL knows what happened. Manumation knows what mattered.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardSection title="System">
            {health ? (
              <div className="space-y-2">
                <StatusDot value={`Relationship Engine — ${health.engines.relationshipEngine}`} />
                <StatusDot value={`GHL Connector — ${health.engines.ghlConnector}`} />
                <StatusDot value={`Database — ${health.engines.database}`} />
                <div className="pt-2 text-sm text-muted">
                  Sender profile: <span className="text-ink">{health.senderProfile}</span> ·
                  Humanity threshold:{" "}
                  <span className="text-ink">{health.humanityThreshold}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Loading…</p>
            )}
          </CardSection>
        </Card>

        <Card>
          <CardSection title="The hero metric">
            <p className="font-serif text-lg leading-relaxed text-ink">
              Next Best Conversation
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Not last activity. Not open rate. Not pipeline stage. The single most
              meaningful conversation you could have next — surfaced for every person
              who reaches out.
            </p>
          </CardSection>
        </Card>
      </div>

      <Card className="mt-4">
        <CardSection title="People">
          <div className="divide-y divide-sand">
            {contacts.map((c) => (
              <Link
                key={c.id}
                to={`/contact/${c.id}`}
                className="flex items-center justify-between py-3 hover:opacity-70"
              >
                <div>
                  <div className="font-medium text-ink">{c.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            ))}
            {contacts.length === 0 && (
              <p className="py-3 text-sm text-muted">No contacts loaded yet.</p>
            )}
          </div>
        </CardSection>
      </Card>
    </div>
  );
}
