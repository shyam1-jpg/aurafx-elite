import "./globals.css";
import RiskWarning from "../components/RiskWarning";

export const metadata = {
  title: "Aura FX Elite AI — Educational AI Market Analysis",
  description:
    "AI-assisted market analysis for education. Not financial advice. Trading involves significant risk."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <RiskWarning banner />
        {children}
        <footer className="border-t border-edge mt-16 py-8 px-6 text-xs text-slate-500 max-w-6xl mx-auto">
          <p className="mb-2 font-semibold text-slate-400">Important information</p>
          <p>
            Aura FX Elite AI provides educational market analysis and demo signals only. Nothing on
            this platform is financial advice, a personal recommendation, or an invitation to trade.
            Trading foreign exchange, CFDs and cryptoassets carries a high level of risk and you may
            lose more than your initial investment. Past performance and demo results are not
            indicators of future results. AI-generated analysis can be wrong. You are solely
            responsible for your own decisions. Aura FX Elite AI is not a broker and does not hold
            client funds. If you are unsure, seek advice from an independent financial adviser
            authorised in your jurisdiction.
          </p>
        </footer>
      </body>
    </html>
  );
}
