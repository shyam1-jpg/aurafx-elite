import RiskWarning from "./RiskWarning";

const statusStyles = {
  BUY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  SELL: "bg-rose-500/15 text-rose-400 border-rose-500/40",
  WAIT: "bg-slate-500/15 text-slate-300 border-slate-500/40"
};

export default function SignalCard({ signal }) {
  const s = statusStyles[signal.status] || statusStyles.WAIT;
  return (
    <div className="bg-panel border border-edge rounded-2xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">{signal.asset}</h3>
          <p className="text-xs text-slate-500">{signal.marketCondition}</p>
          <p className="text-sm mt-1">
            <span className="text-slate-400">{signal.currentPrice}</span>{" "}
            <span
              className={
                signal.priceSource === "live"
                  ? "text-[10px] text-emerald-400 uppercase"
                  : "text-[10px] text-slate-500 uppercase"
              }
            >
              {signal.priceSource === "live" ? "live" : "demo price"}
            </span>
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-bold border ${s}`}>
          {signal.status}
        </span>
      </div>

      {signal.status !== "WAIT" ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
          <Field label="Entry zone" value={signal.entryZone} />
          <Field label="Stop loss" value={signal.stopLoss} accent="text-rose-400" />
          <Field label="Target 1" value={signal.target1} accent="text-emerald-400" />
          <Field label="Target 2" value={signal.target2} accent="text-emerald-400" />
        </div>
      ) : (
        <p className="text-sm text-slate-400 mb-3">
          No trade setup. Conditions are unclear — standing aside is a position.
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
        <span>
          Demo confidence:{" "}
          <span className="text-gold font-semibold">{signal.confidence}%</span>
        </span>
        <span>Generated: {signal.generatedAt}</span>
        <span
          className={
            signal.valid ? "text-emerald-400" : "text-slate-500 line-through"
          }
        >
          {signal.valid ? "Valid" : "Expired"}
        </span>
      </div>

      <div className="bg-night/60 border border-edge rounded-lg p-3 text-xs text-slate-300 leading-relaxed">
        <span className="text-skyblue font-semibold">Illustrative analysis: </span>
        {signal.explanation}
      </div>

      <RiskWarning />
    </div>
  );
}

function Field({ label, value, accent = "text-white" }) {
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className={`font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
