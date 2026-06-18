import { useState } from "react";
import { Check, Pencil, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import type { GradedDraft } from "../lib/types";
import { Card, CardSection, Button, Badge, InfoTip } from "./ui";
import { cn, scoreTone } from "../lib/utils";

interface Props {
  draft: GradedDraft;
  threshold: number;
  /** 1 or 2 — shown so each card is unmistakably one of the two options. */
  index?: number;
  onApprove: (text: string) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  busy?: boolean;
}

export function DraftCard({
  draft,
  threshold,
  index,
  onApprove,
  onRegenerate,
  onDelete,
  busy,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.text);

  const passed = draft.grade.overall >= threshold;
  const style = draft.tone === "warm" ? "Warm" : "Direct";

  return (
    <Card className={cn(!passed && "border-clay/40")}>
      <CardSection>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">
            {index ? `Option ${index} · ${style}` : style}
          </span>
          <div className="flex items-center gap-2">
            {draft.rewritten && <Badge>auto-rewritten</Badge>}
            <span
              className={cn(
                "flex items-center gap-1 text-sm font-semibold",
                scoreTone(draft.grade.overall),
              )}
            >
              {!passed && <AlertTriangle className="h-3.5 w-3.5" />}
              Humanity {draft.grade.overall}
              {draft.grade.notes && <InfoTip text={draft.grade.notes} />}
            </span>
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
          <p className="mt-2 text-xs text-clay">Flagged: {draft.grade.flags.join(", ")}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => onApprove(text)} disabled={busy}>
            <Check className="h-4 w-4" /> Approve &amp; Send
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
