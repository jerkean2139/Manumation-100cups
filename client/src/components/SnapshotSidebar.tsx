import { Compass, Heart, Clock, ShieldAlert, Sparkles } from "lucide-react";
import type { Snapshot } from "../lib/types";
import { stageLabel } from "../lib/utils";
import { Card, Badge, ScoreMeter } from "./ui";

const SCORE_FIELDS: { key: keyof Snapshot["scores"]; label: string; help: string }[] = [
  {
    key: "relationshipHealth",
    label: "Relationship Health",
    help: "Overall health of the relationship, 0 to 100. The engine estimates it from your history together, blending trust, engagement, and the balance of giving vs asking.",
  },
  {
    key: "trust",
    label: "Trust",
    help: "How much trust has been built, both ways, 0 to 100. Higher means more candor, reliability, and follow-through in the relationship.",
  },
  {
    key: "humanity",
    label: "Humanity",
    help: "How human vs transactional the relationship feels, 0 to 100. Higher means real connection, not just business.",
  },
  {
    key: "hundredCups",
    label: "100 Cups",
    help: "Relationship deposits minus withdrawals, 0 to 100. 50 is neutral. Higher means you have been giving more than asking: helping, remembering, encouraging, celebrating.",
  },
  {
    key: "engagement",
    label: "Engagement",
    help: "How actively this person is engaging right now, 0 to 100, based on recent replies and responsiveness.",
  },
];

const NBC_HELP =
  "How ripe the moment is for a meaningful conversation right now, 0 to 100. Higher means there is a clear, timely thing worth reaching out about.";

function Tile({
  icon: Icon,
  label,
  children,
  accent,
}: {
  icon: typeof Compass;
  label: string;
  children: React.ReactNode;
  accent?: "sage" | "clay";
}) {
  const tone =
    accent === "sage" ? "text-sage" : accent === "clay" ? "text-clay" : "text-muted";
  return (
    <Card
      className={
        accent === "sage"
          ? "border-sage/30 bg-sage/5"
          : accent === "clay"
            ? "border-clay/30 bg-clay/5"
            : ""
      }
    >
      <div className="p-4">
        <div className={`flex items-center gap-1.5 ${tone}`}>
          <Icon className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        </div>
        <div className="mt-1.5 text-sm leading-snug text-ink">{children}</div>
      </div>
    </Card>
  );
}

/**
 * The "about this person" rail. Compact tiles meant to sit in a right-hand
 * sidebar next to the suggested replies, so everything that matters about the
 * relationship is visible at a glance while reading the drafts.
 */
export function SnapshotSidebar({ snapshot: s }: { snapshot: Snapshot }) {
  return (
    <div className="space-y-3">
      <Tile icon={Sparkles} label="Next Best Conversation" accent="sage">
        <p className="font-serif text-base leading-snug">{s.nextBestConversation}</p>
      </Tile>

      <Tile icon={Heart} label="Why they matter">
        {s.whyTheyMatter}
        <div className="mt-2">
          <Badge>{stageLabel(s.stage)}</Badge>
        </div>
      </Tile>

      <Card>
        <div className="space-y-2.5 p-4">
          <ScoreMeter
            label="Next Best Conversation"
            value={s.scores.nextBestConversation}
            hero
            help={NBC_HELP}
          />
          {SCORE_FIELDS.map((f) => (
            <ScoreMeter key={f.key} label={f.label} value={s.scores[f.key]} help={f.help} />
          ))}
        </div>
      </Card>

      <Tile icon={Compass} label="Current Season">
        {s.currentSeason}
      </Tile>

      <Tile icon={Heart} label="Best Memory">
        {s.bestMemory}
      </Tile>

      <Tile icon={Clock} label="Last Meaningful Moment">
        {s.lastMeaningfulMoment}
      </Tile>

      {s.avoidSaying.length > 0 && (
        <Tile icon={ShieldAlert} label="Avoid Saying" accent="clay">
          <ul className="list-inside list-disc space-y-1">
            {s.avoidSaying.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Tile>
      )}
    </div>
  );
}
