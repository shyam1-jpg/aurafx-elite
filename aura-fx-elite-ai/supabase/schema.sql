-- Aura FX Elite AI — starter Supabase schema
-- Demo/educational platform. Extend as the product grows.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  risk_acknowledged_at timestamptz,          -- user accepted risk disclosure
  created_at timestamptz not null default now()
);

create table assets (
  id serial primary key,
  symbol text not null unique,               -- e.g. 'BTC/USD'
  asset_class text not null check (asset_class in ('crypto','forex','commodity','index')),
  is_active boolean not null default true
);

create table signals (
  id uuid primary key default gen_random_uuid(),
  asset_id int not null references assets(id),
  status text not null check (status in ('BUY','SELL','WAIT')),
  market_condition text,                     -- Trending / Range / High volatility
  entry_low numeric,
  entry_high numeric,
  stop_loss numeric,
  target_1 numeric,
  target_2 numeric,
  confidence int check (confidence between 0 and 100),
  explanation text,                          -- AI plain-English analysis
  is_demo boolean not null default true,
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  approved_by uuid references profiles(id),
  generated_at timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now()
);
create index idx_signals_asset on signals(asset_id);
create index idx_signals_approval on signals(approval_status, generated_at desc);

create table watchlists (
  user_id uuid not null references profiles(id) on delete cascade,
  asset_id int not null references assets(id),
  primary key (user_id, asset_id)
);

create table plans (
  id serial primary key,
  name text not null,                        -- Free / Pro
  price_monthly_pence int not null default 0,
  features jsonb
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id int not null references plans(id),
  stripe_subscription_id text,
  status text not null default 'active' check (status in ('active','past_due','canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  channel text not null check (channel in ('email','telegram')),
  destination text not null,                 -- email address / telegram chat id
  is_enabled boolean not null default true
);

create table alert_log (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references alerts(id),
  signal_id uuid references signals(id),
  sent_at timestamptz not null default now(),
  success boolean not null,
  error text
);

create table admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id),
  action text not null,                      -- 'approve_signal', 'reject_signal', ...
  target_id text,
  created_at timestamptz not null default now()
);

-- Row Level Security (enable and refine before launch)
alter table profiles enable row level security;
alter table signals enable row level security;
alter table watchlists enable row level security;
alter table subscriptions enable row level security;
alter table alerts enable row level security;

-- Users see only approved signals; admins manage via service role
create policy "read approved signals" on signals
  for select using (approval_status = 'approved');
create policy "own profile" on profiles
  for select using (auth.uid() = id);
create policy "own watchlist" on watchlists
  for all using (auth.uid() = user_id);
create policy "own alerts" on alerts
  for all using (auth.uid() = user_id);
create policy "own subscription" on subscriptions
  for select using (auth.uid() = user_id);

-- Seed assets
insert into assets (symbol, asset_class) values
  ('BTC/USD','crypto'), ('ETH/USD','crypto'), ('XAU/USD','commodity'),
  ('EUR/USD','forex'), ('GBP/USD','forex');
