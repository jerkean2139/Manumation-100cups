import { useState } from "react";
import { Check, Pencil, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import type { GradedDraft } from "../lib/types";
import { Card, CardSection, Button, Badge } from "./ui";
import { cn, scoreTone } from "../lib/utils";

interface Props {
  draft: GradedDraft;
  threshold: number;
  onApprove: (text: string) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  busy?: boolean;
}

export function DraftCard({
  draft,
  threshold,
  onApprove,
  onRegenerate,
  onDelete,
  busy,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.text);

  const passed = draft.grade.overall >= threshold;

  return (
    <Card className={cn(!passed && "border-clay/40")}>
      <CardSection>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold capitalize text-ink">
              {draft.tone === "warm" ? "Warm & conversational" : "Direct & practical"}
            </span>
            {draft.rewritten && <Badge>auto-rewritten</Badge>}
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 text-sm font-semibold",
              scoreTone(draft.grade.overall),
            )}
          >
            {!passed && <AlertTriangle className="h-3.5 w-3.5" />}
            Humanity {draft.grade.overall}
          </div>
        </div>

        {editing ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-sand bg-canvas p-3 text-sm text-ink focus:border-ink focus:outline-none"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{text}</p>
        )}

        {draft.grade.flags.length > 0 && (
          <p className="mt-2 text-xs text-clay">
            Flagged: {draft.grade.flags.join(", ")}
          </p>
        )}
        {draft.grade.notes && (
          <p className="mt-2 text-xs leading-relaxed text-muted">{draft.grade.notes}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => onApprove(text)} disabled={busy}>
            <Check className="h-4 w-4" /> Approve & Send
          </Button>
          <Button variant="outline" onClick={() => setEditing((v) => !v)} disabled={busy}>
            <Pencil className="h-4 w-4" /> {editing ? "Done" : "Edit"}
          </Button>
          <Button variant="ghost" onClick={onRegenerate} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> Regenerate
          </Button>
          <Button variant="danger" onClick={onDelete} disabled={busy}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </CardSection>
    </Card>
  );
}
