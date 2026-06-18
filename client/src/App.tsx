import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Inbox, LayoutGrid, LogOut, Settings as SettingsIcon, User } from "lucide-react";
import { cn } from "./lib/utils";
import { api, auth, setUnauthorizedHandler } from "./lib/api";
import InboxAssistant from "./pages/InboxAssistant";
import Dashboard from "./pages/Dashboard";
import ContactSnapshot from "./pages/ContactSnapshot";
import Settings from "./pages/Settings";
import Login from "./pages/Login";

const NAV = [
  { to: "/", label: "Inbox Assistant", icon: Inbox, end: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, end: false },
  { to: "/contact", label: "Contacts", icon: User, end: false },
  { to: "/settings", label: "Settings", icon: SettingsIcon, end: false },
];

function Sidebar({ onLogout, showLogout }: { onLogout: () => void; showLogout: boolean }) {
  return (
    <aside className="w-64 shrink-0 border-r border-sand bg-paper/60 p-6 hidden md:flex md:flex-col">
      <div className="mb-8">
        <div className="font-serif text-xl text-ink">Manumation</div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted">Snapshot</div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                isActive ? "bg-sand text-ink" : "text-muted hover:bg-sand/60",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto pt-8">
        <p className="text-xs leading-relaxed text-muted">
          It helps you remember people — so your conversations feel remembered, not
          marketed to.
        </p>
        {showLogout && (
          <button
            onClick={onLogout}
            className="mt-4 flex items-center gap-2 text-xs text-muted hover:text-ink"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        )}
      </div>
    </aside>
  );
}

type AuthState = "checking" | "needsLogin" | "ready";

export default function App() {
  const [state, setState] = useState<AuthState>("checking");
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    // Drop back to login whenever a request reports an expired/invalid session.
    setUnauthorizedHandler(() => setState("needsLogin"));

    api
      .authStatus()
      .then(({ authRequired }) => {
        setAuthRequired(authRequired);
        if (!authRequired || auth.get()) setState("ready");
        else setState("needsLogin");
      })
      .catch(() => setState("ready")); // status endpoint is public; treat failure as open
  }, []);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  if (state === "needsLogin") {
    return <Login onSuccess={() => setState("ready")} />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        showLogout={authRequired}
        onLogout={() => {
          auth.clear();
          setState("needsLogin");
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<InboxAssistant />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/contact" element={<ContactSnapshot />} />
          <Route path="/contact/:id" element={<ContactSnapshot />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
