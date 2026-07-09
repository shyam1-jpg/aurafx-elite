export const metadata = { title: "Risk Disclosure — Aura FX Elite AI" };

export default function Legal() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-sm leading-relaxed text-slate-300">
      <h1 className="text-3xl font-bold text-white mb-6">Risk Disclosure &amp; Disclaimer</h1>

      <Section title="Not financial advice">
        Aura FX Elite AI provides educational market analysis and demonstration signals only.
        Nothing on this platform constitutes financial advice, a personal recommendation, or an
        offer or solicitation to buy or sell any financial instrument. We do not consider your
        personal circumstances, objectives, or financial situation.
      </Section>

      <Section title="Trading is high risk">
        Trading foreign exchange, CFDs, commodities, and cryptoassets carries a high level of risk
        and is not suitable for everyone. Leverage can work against you. You could lose some or all
        of your invested capital. Never trade with money you cannot afford to lose.
      </Section>

      <Section title="AI and model risk">
        Analysis on this platform is generated with the assistance of automated rules and AI
        language models. AI output can be incomplete, out of date, or simply wrong. Signals are
        informational and educational only, and past or demo performance is not a reliable
        indicator of future results.
      </Section>

      <Section title="We are not a broker">
        Aura FX Elite AI is not a broker, does not execute trades, does not hold client funds, and
        does not provide portfolio management. Any third-party broker you choose is your own
        decision and your relationship is with them, not us.
      </Section>

      <Section title="Your responsibility">
        You alone are responsible for your trading decisions. If you are unsure whether trading is
        appropriate for you, seek advice from an independent financial adviser who is authorised in
        your jurisdiction (in the UK, check the FCA register at register.fca.org.uk).
      </Section>

      <p className="text-xs text-slate-500 mt-8">
        This template wording is a starting point only and is not legal advice. Have a qualified
        solicitor review all legal pages before launch, particularly regarding FCA financial
        promotion rules.
      </p>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
