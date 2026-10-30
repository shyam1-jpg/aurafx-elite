import type { EngineSignal, MeasuredStats } from './types';

const THREE = new Set(['USDJPY', 'EURJPY', 'GBPJPY', 'XAGUSD', 'NATGAS']);
const TWO = new Set(['XAUUSD', 'USOIL', 'UKOIL']);

export function priceDigits(instrument: string): number {
  if (THREE.has(instrument)) return 3;
  if (TWO.has(instrument)) return 2;
  if (instrument === 'COPPER') return 4;
  return 5;
}

export function formatPrice(instrument: string, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(priceDigits(instrument));
}

export function formatWhen(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function actionOf(signal: EngineSignal): string {
  const action = String(signal.action || 'WAIT').toUpperCase();
  if (action === 'BUY' || action === 'SELL' || action === 'WAIT') return action;
  return 'WAIT';
}

export function isPublished(signal: EngineSignal): boolean {
  return actionOf(signal) === 'BUY' || actionOf(signal) === 'SELL';
}

export function assetLabel(asset: string | undefined): string {
  if (asset === 'forex') return 'Forex';
  if (asset === 'metal') return 'Metals';
  if (asset === 'commodity') return 'Commodities';
  return asset || 'Market';
}

export function winText(measured: MeasuredStats | null | undefined): string {
  if (!measured || !measured.resolved) return 'No closed signals yet';
  const rate = measured.win_rate;
  if (rate == null || !Number.isFinite(rate)) return 'No closed signals yet';
  const pct = Math.round(rate * 1000) / 10;
  const small = measured.sample_note ? ` ${measured.sample_note}` : '';
  return `${pct}% from ${measured.resolved} closed signals.${small}`;
}

export function profitFactorText(measured: MeasuredStats | null | undefined): string {
  if (!measured) return '—';
  if (measured.profit_factor != null && Number.isFinite(measured.profit_factor)) {
    return String(measured.profit_factor);
  }
  return measured.profit_factor_note || '—';
}

export function averageRText(measured: MeasuredStats | null | undefined): string {
  if (!measured || measured.average_r == null || !Number.isFinite(measured.average_r)) return '—';
  return `${measured.average_r}R`;
}

export function drawdownText(measured: MeasuredStats | null | undefined): string {
  if (!measured || measured.max_drawdown_r == null || !Number.isFinite(measured.max_drawdown_r)) return '—';
  return `${measured.max_drawdown_r}R`;
}

export function leadLine(signal: EngineSignal): string {
  const text = String(signal.rationale || '').trim();
  if (!text) {
    const blocker = (signal.blockers || []).find(Boolean);
    return blocker || signal.regime_note || '';
  }
  const sentence = text.split(/(?<=\.)\s/)[0] || text;
  return sentence.length > 180 ? `${sentence.slice(0, 177)}…` : sentence;
}

export function confidenceLabel(signal: EngineSignal): { title: string; value: string; note: string } {
  if (signal.confidence == null || !Number.isFinite(Number(signal.confidence))) {
    return { title: 'Confidence', value: '—', note: 'The scan did not return a score.' };
  }
  const value = String(signal.confidence);
  if (signal.confidence_calibrated && signal.confidence_basis) {
    return { title: 'Confidence', value, note: signal.confidence_basis };
  }
  return {
    title: 'Setup score',
    value,
    note: signal.confidence_basis || 'Setup quality score from this scan. It is not a forecast.',
  };
}
