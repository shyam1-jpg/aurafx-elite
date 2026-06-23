-- Aura Elite FX — platform database schema (Neon Postgres)
-- Phase 1+ foundation. Run via migrations when DATABASE_URL is set.

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  email_verified_at TIMESTAMPTZ,
  role TEXT NOT NULL DEFAULT 'user',
  trading_mode TEXT NOT NULL DEFAULT 'analysis_only',
  auto_trading_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  risk_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  country TEXT,
  timezone TEXT,
  subscription_plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  risk_per_trade_pct NUMERIC(5,2) DEFAULT 1.0,
  max_daily_loss_pct NUMERIC(5,2) DEFAULT 3.0,
  max_weekly_loss_pct NUMERIC(5,2) DEFAULT 7.0,
  max_open_trades INT DEFAULT 3,
  max_exposure_per_currency NUMERIC(5,2),
  emergency_stop BOOLEAN DEFAULT FALSE,
  allowed_pairs TEXT[],
  max_lot_size NUMERIC(10,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signals (
  id BIGSERIAL PRIMARY KEY,
  signal_uid TEXT UNIQUE NOT NULL,
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  confidence_score INT,
  entry_zone JSONB,
  stop_loss NUMERIC,
  take_profit_1 NUMERIC,
  take_profit_2 NUMERIC,
  risk_reward NUMERIC,
  final_action TEXT,
  reason TEXT,
  source TEXT DEFAULT 'engine',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signal_results (
  id BIGSERIAL PRIMARY KEY,
  signal_id BIGINT REFERENCES signals(id),
  user_id BIGINT REFERENCES users(id),
  result TEXT,
  pips NUMERIC,
  profit_loss NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broker_connections (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_label TEXT,
  credentials_encrypted TEXT,
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  status TEXT DEFAULT 'disconnected'
);

CREATE TABLE IF NOT EXISTS api_keys_encrypted (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  key_encrypted TEXT NOT NULL,
  key_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  event_type TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_email TEXT,
  action TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
