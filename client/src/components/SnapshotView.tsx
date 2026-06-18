import { Compass, Heart, Clock, ShieldAlert, Sparkles } from "lucide-react";
import type { Snapshot } from "../lib/types";
import { stageLabel } from "../lib/utils";
import { Card, CardSection, Badge, ScoreMeter } from "./ui";

const SCORE_FIELDS: { key: keyof Snapshot["scores"]; label: string }[] = [
  { key: "relationshipHealth", label: "Relationship Health" },
  { key: "trust", label: "Trust" },
  { key: "humanity", label: "Humanity" },
  { key: "hundredCups", label: "100 Cups" },
  { key: "engagement", label: "Engagement" },
];

export function SnapshotView({ snapshot }: { snapshot: Snapshot }) {
  const s = snapshot;
  return (
    <div className="space-y-4">
      {/* The hero metric — Next Best Conversation. */}
      <Card className="border-sage/30 bg-gradient-to-br from-paper to-sage/5">
        <CardSection>
          <div className="flex items-center gap-2 text-sage">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Next Best Conversation
            </span>
          </div>
          <p className="mt-2 font-serif text-lg leading-relaxed text-ink">
            {s.nextBestConversation}
          </p>
        </CardSection>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardSection title="Why they matter">
            <p className="text-sm leading-relaxed text-ink">{s.whyTheyMatter}</p>
            <div className="mt-3">
              <Badge>{stageLabel(s.stage)}</Badge>
            </div>
          </CardSection>
        </Card>

        <Card>
          <CardSection title="Relationship Scores">
            <div className="space-y-3">
              <ScoreMeter
                label="Next Best Conversation"
                value={s.scores.nextBestConversation}
                hero
              />
              {SCORE_FIELDS.map((f) => (
                <ScoreMeter key={f.key} label={f.label} value={s.scores[f.key]} />
              ))}
            </div>
          </CardSection>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardSection>
            <div className="flex items-center gap-2 text-muted">
              <Compass className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Current Season
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink">{s.currentSeason}</p>
          </CardSection>
        </Card>

        <Card>
          <CardSection>
            <div className="flex items-center gap-2 text-muted">
              <Heart className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Best Memory
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink">{s.bestMemory}</p>
          </CardSection>
        </Card>

        <Card>
          <CardSection>
            <div className="flex items-center gap-2 text-muted">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Last Meaningful Moment
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              {s.lastMeaningfulMoment}
            </p>
          </CardSection>
        </Card>
      </div>

      {s.avoidSaying.length > 0 && (
        <Card className="border-clay/30 bg-clay/5">
          <CardSection>
            <div className="flex items-center gap-2 text-clay">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Avoid Saying
              </span>
            </div>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink">
              {s.avoidSaying.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </CardSection>
        </Card>
      )}
    </div>
  );
}
