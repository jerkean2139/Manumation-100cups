import { useState } from "react";
import { LogIn } from "lucide-react";
import { api, auth } from "../lib/api";
import { Card, CardSection, Button } from "../components/ui";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api.login(password);
      auth.set(r.token);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="font-serif text-2xl text-ink">Manumation</div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Snapshot</div>
        </div>
        <Card>
          <CardSection>
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Password
                </span>
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-sand bg-canvas px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                />
              </label>
              {error && <p className="text-sm text-clay">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || !password}>
                <LogIn className="h-4 w-4" /> {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardSection>
        </Card>
        <p className="mt-4 text-center text-xs text-muted">
          It helps you remember people.
        </p>
      </div>
    </div>
  );
}
