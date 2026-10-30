export type SignalFactor = {
  key?: string;
  label?: string;
  state?: string;
  note?: string;
};

export type EngineSignal = {
  instrument: string;
  name?: string;
  asset?: string;
  action?: string;
  published?: boolean;
  confidence?: number | null;
  confidence_basis?: string | null;
  confidence_calibrated?: boolean;
  entry?: number | null;
  entry_zone?: number[] | null;
  stop_loss?: number | null;
  take_profit_1?: number | null;
  take_profit_2?: number | null;
  risk_reward?: number | null;
  price?: number | null;
  timeframe?: string;
  factors?: SignalFactor[];
  blockers?: string[];
  regime?: string | null;
  regime_note?: string | null;
  session?: string | null;
  support?: number | null;
  resistance?: number | null;
  rsi?: number | null;
  atr?: number | null;
  rationale?: string | null;
  feed_note?: string | null;
  feed_stale?: boolean;
  data_quality?: string;
  disclaimer?: string;
};

export type SignalBoard = {
  ok?: boolean;
  updated_at?: string;
  source?: string;
  publication_rule?: string;
  price_note?: string;
  feed?: { status?: string; detail?: string; available?: number; stale?: number };
  signals?: EngineSignal[];
  summary?: { buy?: number; sell?: number; wait?: number; scanned?: number };
  disclaimer?: string;
};

export type MeasuredStats = {
  resolved?: number;
  wins?: number;
  losses?: number;
  open?: number;
  expired?: number;
  win_rate?: number | null;
  average_r?: number | null;
  profit_factor?: number | null;
  profit_factor_note?: string | null;
  max_drawdown_r?: number | null;
  sample_note?: string | null;
  win_rate_basis?: string | null;
  by_instrument?: Record<string, MeasuredStats>;
};

export type EquityPoint = {
  t?: string | null;
  equity_r?: number;
  drawdown_r?: number;
  instrument?: string;
  result_r?: number;
};

export type TrackRecord = {
  ok?: boolean;
  instrument?: string;
  signals?: Array<Record<string, unknown>>;
  measured?: MeasuredStats;
  equity?: EquityPoint[];
  basis?: string;
  disclaimer?: string;
  updated_at?: string;
};

export type MarketRow = {
  symbol?: string;
  price?: string;
  spotPrice?: string;
  priceNum?: number | null;
  dailyChange?: string;
  changePct?: number | null;
  trend?: string;
  live?: boolean;
};

export type MarketsPayload = {
  live?: boolean;
  dataMode?: string;
  source?: string;
  updatedAt?: string;
  disclaimer?: string;
  forex?: { majors?: MarketRow[]; minors?: MarketRow[]; exotics?: MarketRow[] };
  metals?: MarketRow[];
  energy?: MarketRow[];
  ag?: MarketRow[];
};

export type PricingTier = {
  id: string;
  name?: string;
  price?: number | null;
  period?: string | null;
  annual_price?: number | null;
  annual_period?: string | null;
  features?: string[];
  delay_minutes?: number;
};

export type Pricing = {
  ok?: boolean;
  currency?: string;
  currency_symbol?: string;
  note?: string;
  contact?: string;
  tiers?: PricingTier[];
};

export type RiskDefaults = {
  per_trade_pct?: number;
  max_daily_loss_pct?: number;
  max_weekly_loss_pct?: number;
  max_open_trades?: number;
  auto_trading?: string;
  note?: string;
};

export type PlansPayload = {
  ok?: boolean;
  risk?: RiskDefaults;
  disclaimer?: string;
  plan_date?: string;
};

export type CandleBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type CandlePayload = {
  ok?: boolean;
  available?: boolean;
  timeframe?: string;
  bars?: CandleBar[];
  note?: string;
  error?: string;
};

export type LoadState<T> = {
  status: 'loading' | 'ready' | 'error';
  data: T | null;
  error: string | null;
};

export function loadingState<T>(): LoadState<T> {
  return { status: 'loading', data: null, error: null };
}
