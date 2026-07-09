export default function RiskWarning({ banner = false }) {
  if (banner) {
    return (
      <div className="bg-[#2A1E0E] border-b border-gold/40 text-amber-200 text-xs text-center px-4 py-2">
        Educational demo only — not financial advice. Trading involves a high risk of loss. AI
        analysis can be wrong. You are responsible for your own decisions.
      </div>
    );
  }
  return (
    <p className="text-[11px] text-amber-300/80 border-t border-edge pt-2 mt-3">
      ⚠ Educational analysis, not financial advice. Trading is high risk — you can lose your
      capital. Demo data only.
    </p>
  );
}
