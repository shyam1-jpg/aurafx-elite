"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SignalCard from "../../components/SignalCard";

export default function Dashboard() {
  const [signals, setSignals] = useState([]);
  const [watchlist, setWatchlist] = useState(["BTC/USD", "ETH/USD", "XAU/USD", "EUR/USD", "GBP/USD"]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataMode, setDataMode] = useState("demo");

  useEffect(() => {
    fetch("/api/signals")
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((d) => {
        setSignals(d.signals || []);
        setDataMode(d.dataMode || "demo");
      })
      .catch(() => setError("Could not load signals. Check the server and try again."))
      .finally(() => setLoading(false));
  }, []);

  const visible = signals.filter(
    (s) => watchlist.includes(s.asset) && (filter === "ALL" || s.status === filter)
  );

  return (
    <main className="max-w-6xl mx-auto px-6">
      <nav className="flex items-center justify-between py-6">
        <Link href="/" className="text-xl font-bold text-gold">
          Aura FX <span className="text-skyblue">Elite AI</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span
            className={`text-xs border px-3 py-1 rounded-full ${
              dataMode === "live"
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                : "bg-panel border-edge text-slate-400"
            }`}
          >
            {dataMode === "live"
              ? "● Live prices — demo analysis"
              : dataMode === "partial"
              ? "◐ Partly live prices — demo analysis"
              : "Demo mode — no live data"}
          </span>
          <Link href="/admin" className="hover:text-gold">
            Admin
          </Link>
        </div>
      </nav>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white mr-auto">Today&apos;s analysis</h1>
        {["ALL", "BUY", "SELL", "WAIT"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm border ${
              filter === f
                ? "bg-gold text-night border-gold font-semibold"
                : "border-edge text-slate-400 hover:border-gold"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {["BTC/USD", "ETH/USD", "XAU/USD", "EUR/USD", "GBP/USD"].map((a) => (
          <button
            key={a}
            onClick={() =>
              setWatchlist((w) => (w.includes(a) ? w.filter((x) => x !== a) : [...w, a]))
            }
            className={`px-3 py-1 rounded-lg text-xs border ${
              watchlist.includes(a) ? "border-skyblue text-skyblue" : "border-edge text-slate-600"
            }`}
          >
            {a}
          </button>
        ))}
        <span className="text-xs text-slate-500 self-center ml-2">Watchlist — click to toggle</span>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading demo signals…</p>
      ) : error ? (
        <p className="text-rose-400 text-sm">{error}</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {visible.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
          {visible.length === 0 && (
            <p className="text-slate-500 text-sm col-span-2">
              No approved signals yet. An admin must approve setups before they appear here.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
