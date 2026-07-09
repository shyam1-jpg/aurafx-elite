import Link from "next/link";

const features = [
  {
    title: "Rules first, AI second",
    body: "Signals come from transparent technical rules (RSI, MACD, EMA, ATR, support/resistance). The AI explains the setup in plain English — it never invents trades."
  },
  {
    title: "WAIT is a valid answer",
    body: "When conditions are unclear, the engine says WAIT / NO TRADE. No forced signals, no pressure to be in the market."
  },
  {
    title: "Risk on every card",
    body: "Every signal shows stop loss, targets, confidence and a risk warning. Education before execution."
  },
  {
    title: "Demo mode by default",
    body: "Learn the workflow with demo signals before any real market data is connected. No auto-trading."
  }
];

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-6">
      <nav className="flex items-center justify-between py-6">
        <span className="text-xl font-bold text-gold">Aura FX <span className="text-skyblue">Elite AI</span></span>
        <div className="flex gap-6 text-sm">
          <Link href="/dashboard" className="hover:text-gold">Dashboard</Link>
          <Link href="/legal" className="hover:text-gold">Risk Disclosure</Link>
          <Link
            href="/dashboard"
            className="bg-gold text-night font-semibold px-4 py-2 rounded-lg hover:opacity-90"
          >
            Try the demo
          </Link>
        </div>
      </nav>

      <section className="py-20 text-center">
        <p className="text-skyblue text-sm font-semibold tracking-widest uppercase mb-4">
          Educational AI market analysis
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
          Understand the market.<br />
          <span className="text-gold">Then decide for yourself.</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto mt-6">
          Aura FX Elite AI turns technical indicators into clear, plain-English market analysis for
          forex, gold and crypto — built for learning, not for promises. No guaranteed profits.
          No auto-trading. You stay in control.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/dashboard"
            className="bg-gold text-night font-semibold px-6 py-3 rounded-lg hover:opacity-90"
          >
            Open demo dashboard
          </Link>
          <Link
            href="/legal"
            className="border border-edge px-6 py-3 rounded-lg hover:border-gold"
          >
            Read the risks first
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6 py-12">
        {features.map((f) => (
          <div key={f.title} className="bg-panel border border-edge rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-slate-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="py-12 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">How it works</h2>
        <p className="text-slate-400 max-w-xl mx-auto text-sm">
          Market data → technical indicator engine → risk filter → strategy rules → AI explanation →
          published to your dashboard. Admin-reviewed before anything goes live.
        </p>
      </section>
    </main>
  );
}
