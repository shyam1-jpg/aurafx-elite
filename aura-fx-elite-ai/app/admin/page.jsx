"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "aura_admin_demo_key";

function adminHeaders(key) {
  const h = { "Content-Type": "application/json" };
  if (key) h["x-admin-key"] = key;
  return h;
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loginError, setLoginError] = useState("");

  const loadQueue = useCallback(
    async (key) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/signals?view=admin", { headers: adminHeaders(key) });
        if (res.status === 401) {
          setAuthed(false);
          sessionStorage.removeItem(STORAGE_KEY);
          setLoginError("Invalid admin key.");
          return;
        }
        if (!res.ok) throw new Error("Could not load queue");
        const d = await res.json();
        setSignals(d.signals);
        setAuthed(true);
        if (key) sessionStorage.setItem(STORAGE_KEY, key);
      } catch {
        setError("Failed to load the approval queue. Try again.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY) || "";
    if (saved) {
      setAdminKey(saved);
      loadQueue(saved);
    } else {
      setLoading(false);
    }
  }, [loadQueue]);

  const tryLogin = (e) => {
    e.preventDefault();
    setLoginError("");
    loadQueue(adminKey.trim());
  };

  const decide = async (id, decision) => {
    setError("");
    try {
      const res = await fetch("/api/signals", {
        method: "POST",
        headers: adminHeaders(sessionStorage.getItem(STORAGE_KEY) || adminKey),
        body: JSON.stringify({ id, decision })
      });
      if (!res.ok) throw new Error("Update failed");
      const d = await res.json();
      setSignals(d.signals);
    } catch {
      setError("Could not save that decision. Try again.");
    }
  };

  if (!authed && !loading) {
    return (
      <main className="max-w-md mx-auto px-6 py-20">
        <h1 className="text-2xl font-bold text-white mb-2">Admin access</h1>
        <p className="text-sm text-slate-500 mb-6">
          Demo admin panel. Set <code className="text-skyblue">ADMIN_DEMO_KEY</code> in{" "}
          <code className="text-slate-400">.env.local</code>. Local dev works without a key.
        </p>
        <form onSubmit={tryLogin} className="space-y-4">
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin demo key"
            className="w-full bg-panel border border-edge rounded-lg px-4 py-2 text-sm"
          />
          {loginError && <p className="text-rose-400 text-sm">{loginError}</p>}
          <button
            type="submit"
            className="w-full bg-gold text-night font-semibold py-2 rounded-lg hover:opacity-90"
          >
            Enter admin
          </button>
        </form>
        <Link href="/" className="block text-center text-sm text-slate-500 mt-6 hover:text-gold">
          ← Back home
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-6">
      <nav className="flex items-center justify-between py-6">
        <Link href="/" className="text-xl font-bold text-gold">
          Aura FX <span className="text-skyblue">Elite AI</span>{" "}
          <span className="text-slate-500 text-sm font-normal">/ admin</span>
        </Link>
        <Link href="/dashboard" className="text-sm hover:text-gold">
          User dashboard →
        </Link>
      </nav>

      <h1 className="text-2xl font-bold text-white mb-1">Signal approval queue</h1>
      <p className="text-sm text-slate-500 mb-6">
        Only <span className="text-emerald-400">approved</span> signals appear on the user dashboard.
        Decisions persist until the server restarts or the UTC day rolls over.
      </p>

      {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}
      {loading ? (
        <p className="text-slate-500">Loading queue…</p>
      ) : (
        <div className="bg-panel border border-edge rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-edge">
                <th className="p-3">Asset</th>
                <th className="p-3">Signal</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id} className="border-b border-edge/50">
                  <td className="p-3 text-white font-medium">{s.asset}</td>
                  <td className="p-3">{s.status}</td>
                  <td className="p-3">{s.status === "WAIT" ? "—" : `${s.confidence}%`}</td>
                  <td className="p-3">
                    <span
                      className={
                        s.approvalStatus === "approved"
                          ? "text-emerald-400"
                          : s.approvalStatus === "rejected"
                          ? "text-rose-400"
                          : "text-amber-300"
                      }
                    >
                      {s.approvalStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => decide(s.id, "approved")}
                      className="px-3 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 text-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(s.id, "rejected")}
                      className="px-3 py-1 rounded bg-rose-500/15 text-rose-400 border border-rose-500/40 text-xs"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
