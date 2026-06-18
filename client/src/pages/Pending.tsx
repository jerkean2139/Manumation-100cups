import { useEffect, useState } from "react";
import { Inbox as InboxIcon, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import type { PendingReview } from "../lib/types";
import { Card, CardSection, Button, Badge, Spinner } from "../components/ui";
import { SnapshotSidebar } from "../components/SnapshotSidebar";
import { DraftCard } from "../components/DraftCard";

export default function Pending() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [persistence, setPersistence] = useState(true);
  const [threshold, setThreshold] = useState(95);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  // Per-draft nonce so a regenerated DraftCard remounts with fresh text.
  const [nonces, setNonces] = useState<Record<string, number>>({});

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 3500);
  };

  async function load() {
    setLoading(true);
    try {
      const r = await api.pending();
      setReviews(r.reviews);
      setPersistence(r.persistence);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.health().then((h) => setThreshold(h.humanityThreshold)).catch(() => {});
  }, []);

  async function approve(review: PendingReview, draftId: string, text: string) {
    setBusyKey(review.key);
    setError("");
    try {
      const r = await api.approve({
        draftId,
        contactId: review.ghlContactId,
        text,
        channel: review.channel,
      });
      // Resolve the whole card: the sibling drafts are no longer needed.
      await Promise.all(
        review.drafts.filter((d) => d.id !== draftId).map((d) => api.deleteDraft(d.id)),
      );
      setReviews((prev) => prev.filter((x) => x.key !== review.key));
      notify(r.sent ? "Approved & sent through GHL." : "Approved (GHL not connected — not sent).");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyKey("");
    }
  }

  async function regenerate(review: PendingReview, tone: "warm" | "direct") {
    setBusyKey(review.key);
    setError("");
    try {
      const r = await api.regenerate({
        contactId: review.ghlContactId,
        inboundMessage: review.inboundMessage,
        channel: review.channel,
        tone,
      });
      const fresh = r.drafts.find((d) => d.tone === tone);
      if (!fresh) return;
      setReviews((prev) =>
        prev.map((x) =>
          x.key !== review.key
            ? x
            : {
                ...x,
                drafts: x.drafts.map((d) =>
                  d.tone === tone ? { ...d, text: fresh.text, grade: fresh.grade, rewritten: false } : d,
                ),
              },
        ),
      );
      setNonces((n) => ({ ...n, [`${review.key}:${tone}`]: (n[`${review.key}:${tone}`] ?? 0) + 1 }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyKey("");
    }
  }

  async function remove(review: PendingReview, draftId: string) {
    setBusyKey(review.key);
    try {
      await api.deleteDraft(draftId);
      setReviews((prev) =>
        prev
          .map((x) =>
            x.key === review.key
              ? { ...x, drafts: x.drafts.filter((d) => d.id !== draftId) }
              : x,
          )
          .filter((x) => x.drafts.length > 0),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl text-ink">Pending Replies</h1>
          <p className="mt-1 text-muted">
            Messages that came in through GHL — snapshot built, replies drafted,
            waiting for your approval.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </header>

      {!persistence && (
        <div className="mb-4 rounded-xl border border-clay/40 bg-clay/5 p-3 text-sm text-clay">
          No database is connected, so inbound snapshots aren't being stored. Set
          <code className="mx-1">DATABASE_URL</code>to enable the pending queue.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-clay/40 bg-clay/5 p-3 text-sm text-clay">
          {error}
        </div>
      )}

      {loading && <Spinner label="Loading pending replies…" />}

      {!loading && reviews.length === 0 && (
        <Card>
          <CardSection>
            <div className="flex flex-col items-center gap-3 py-10 text-center text-muted">
              <InboxIcon className="h-8 w-8" />
              <p className="text-sm">
                Nothing waiting. When a message arrives in GHL, its snapshot and
                replies will appear here for approval.
              </p>
            </div>
          </CardSection>
        </Card>
      )}

      <div className="space-y-10">
        {reviews.map((review) => (
          <section key={review.key}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-ink">{review.contactName}</h2>
              <Badge>{review.channel}</Badge>
            </div>

            <Card className="mb-4 bg-sand/40">
              <CardSection>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  They said
                </span>
                <p className="mt-1 text-sm text-ink">"{review.inboundMessage}"</p>
              </CardSection>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              {/* Left: the replies to act on. */}
              <div className="space-y-4">
                <h3 className="font-serif text-xl text-ink">Suggested replies</h3>
                {review.drafts.map((d) => (
                  <DraftCard
                    key={`${d.id}-${nonces[`${review.key}:${d.tone}`] ?? 0}`}
                    draft={d}
                    threshold={threshold}
                    busy={busyKey === review.key}
                    onApprove={(text) => approve(review, d.id, text)}
                    onRegenerate={() => regenerate(review, d.tone)}
                    onDelete={() => remove(review, d.id)}
                  />
                ))}
              </div>

              {/* Right: about this person. */}
              {review.snapshot && (
                <aside className="self-start lg:sticky lg:top-6">
                  <SnapshotSidebar snapshot={review.snapshot} />
                </aside>
              )}
            </div>
          </section>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-ink px-4 py-2 text-sm text-canvas shadow-soft">
          {toast}
        </div>
      )}
    </div>
  );
}
