import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Settings as SettingsType } from "../lib/types";
import { Card, CardSection, Button } from "../components/ui";
import { cn } from "../lib/utils";

const AUTO_MODES: { key: keyof SettingsType; label: string; note: string }[] = [
  { key: "autoSms", label: "SMS", note: "Auto-send approved SMS replies" },
  { key: "autoEmail", label: "Email", note: "Auto-send approved emails" },
  { key: "autoInbox", label: "Inbox", note: "Auto-send approved inbox replies" },
  { key: "autoVoicemail", label: "Voicemail", note: "Phase 4 — not yet active" },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative h-6 w-11 rounded-full",
        on ? "bg-sage" : "bg-sand",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow-soft",
          on ? "left-[1.375rem]" : "left-0.5",
        )}
      />
    </button>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings);
  }, []);

  async function patch(p: Partial<SettingsType>) {
    if (!settings) return;
    const next = { ...settings, ...p };
    setSettings(next);
    const updated = await api.updateSettings(p);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) return <div className="p-10 text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink">Settings</h1>
        <p className="mt-1 text-muted">
          Foundation first: remembering. Automation is opt-in, per channel.
        </p>
      </header>

      <Card>
        <CardSection title="Auto Mode">
          <div className="space-y-4">
            {AUTO_MODES.map((m) => (
              <div key={m.key} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-ink">{m.label}</div>
                  <div className="text-xs text-muted">{m.note}</div>
                </div>
                <Toggle
                  on={Boolean(settings[m.key])}
                  onClick={() => patch({ [m.key]: !settings[m.key] } as Partial<SettingsType>)}
                />
              </div>
            ))}
          </div>
        </CardSection>
      </Card>

      <Card className="mt-4">
        <CardSection title="Humanity Score Threshold">
          <p className="mb-3 text-xs text-muted">
            Replies scoring below this are rejected and rewritten. Default 95.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={80}
              max={100}
              value={settings.humanityThreshold}
              onChange={(e) => patch({ humanityThreshold: Number(e.target.value) })}
              className="flex-1 accent-ink"
            />
            <span className="w-10 text-right text-lg font-semibold tabular-nums text-ink">
              {settings.humanityThreshold}
            </span>
          </div>
        </CardSection>
      </Card>

      <Card className="mt-4">
        <CardSection title="Sender Profile">
          <input
            value={settings.senderName}
            onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
            className="w-full rounded-xl border border-sand bg-canvas px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
          />
          <div className="mt-3">
            <Button onClick={() => patch({ senderName: settings.senderName })}>
              Save sender
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            V1 is optimized around one voice. Multiple sender profiles come later.
          </p>
        </CardSection>
      </Card>

      {saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-ink px-4 py-2 text-sm text-canvas shadow-soft">
          Saved
        </div>
      )}
    </div>
  );
}
