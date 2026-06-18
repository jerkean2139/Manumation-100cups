import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { api } from "../lib/api";
import type { PromptConfig } from "../lib/types";
import { Card, CardSection, Button, Spinner } from "./ui";

const FIELDS: { key: keyof PromptConfig; label: string; rows: number }[] = [
  { key: "mission", label: "Mission", rows: 7 },
  { key: "jeremyVoice", label: "Voice — who the sender is and isn't", rows: 7 },
  { key: "humanityStandards", label: "Humanity standards — dead phrases & what to reject", rows: 9 },
  { key: "memoryGuidance", label: "Memory guidance — what's worth remembering", rows: 9 },
  { key: "warmStyle", label: "Reply Option 1 — warm style", rows: 2 },
  { key: "directStyle", label: "Reply Option 2 — direct style", rows: 2 },
];

const EFFORTS: PromptConfig["effort"][] = ["low", "medium", "high"];

/**
 * The full, editable voice/prompt profile. Every block of prompt copy and every
 * lever the engines use is here, so the user can tune the voice without a deploy.
 */
export function PromptProfile() {
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const [help, setHelp] = useState<Record<string, string>>({});
  const [persistence, setPersistence] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  function notify(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 3500);
  }

  useEffect(() => {
    api.getPromptConfig().then((r) => {
      setConfig(r.config);
      setHelp(r.help);
      setPersistence(r.persistence);
    });
  }, []);

  function set<K extends keyof PromptConfig>(key: K, value: PromptConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  }

  async function save() {
    if (!config) return;
    setBusy(true);
    try {
      const r = await api.savePromptConfig(config);
      setConfig(r.config);
      notify("Voice profile saved. It takes effect on the next reply.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm("Reset the entire voice profile to the shipped defaults?")) return;
    setBusy(true);
    try {
      const r = await api.resetPromptConfig();
      setConfig(r.config);
      notify("Reset to defaults.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!config) {
    return (
      <Card className="mt-4">
        <CardSection>
          <Spinner label="Loading voice profile…" />
        </CardSection>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardSection title="Voice & Prompt Profile">
        <p className="mb-4 text-xs leading-relaxed text-muted">
          This is the actual instruction set the AI uses. Edit any of it to tune how
          memories are extracted, how snapshots read, and how replies sound. Leave a
          field blank to fall back to the shipped default.
        </p>

        {!persistence && (
          <div className="mb-4 rounded-xl border border-clay/40 bg-clay/5 p-3 text-xs text-clay">
            No database connected, so edits can't be saved. Set DATABASE_URL to persist
            the profile.
          </div>
        )}

        <div className="space-y-5">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-ink">{f.label}</span>
              {help[f.key] && (
                <span className="mt-0.5 block text-xs text-muted">{help[f.key]}</span>
              )}
              <textarea
                value={config[f.key] as string}
                onChange={(e) => set(f.key, e.target.value as PromptConfig[typeof f.key])}
                rows={f.rows}
                className="mt-1.5 w-full rounded-xl border border-sand bg-canvas p-3 font-mono text-xs leading-relaxed text-ink focus:border-ink focus:outline-none"
              />
            </label>
          ))}

          <div>
            <span className="text-sm font-medium text-ink">Thinking effort</span>
            {help.effort && (
              <span className="mt-0.5 block text-xs text-muted">{help.effort}</span>
            )}
            <div className="mt-1.5 flex gap-2">
              {EFFORTS.map((e) => (
                <button
                  key={e}
                  onClick={() => set("effort", e)}
                  className={
                    "flex-1 rounded-xl border px-3 py-2 text-sm capitalize " +
                    (config.effort === e
                      ? "border-ink bg-ink text-canvas"
                      : "border-sand bg-canvas text-muted hover:bg-sand")
                  }
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Button onClick={save} disabled={busy || !persistence}>
            <Save className="h-4 w-4" /> Save voice profile
          </Button>
          <Button variant="ghost" onClick={reset} disabled={busy}>
            <RotateCcw className="h-4 w-4" /> Reset to defaults
          </Button>
        </div>
      </CardSection>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-ink px-4 py-2 text-sm text-canvas shadow-soft">
          {toast}
        </div>
      )}
    </Card>
  );
}
