//+------------------------------------------------------------------+
//| AuraFX_Quantum_Queen_EA.mq5                                      |
//| XAUUSD flagship — multi-strategy regime engine + smart grid      |
//| Inspired by top MQL5 gold EAs — original Aura Elite FX logic       |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Quantum Queen style: 6 strategies, smart grid, spread/news filters."
#property description "Educational only — no guaranteed profit. Demo first."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_Pro.mqh>
#include <AuraFX_NewsRisk.mqh>
#include <AuraFX_Structure.mqh>
#include <AuraFX_GridEngine.mqh>

enum ENUM_AURA_RISK_PRESET
  {
   AURA_PRESET_LOW    = 0,
   AURA_PRESET_MEDIUM = 1
  };

enum ENUM_AURA_BROKER_PRESET
  {
   AURA_BROKER_IC_RAW     = 0,
   AURA_BROKER_ROBO_ECN   = 1,
   AURA_BROKER_GENERIC    = 2
  };

input group "=== Plug & Play ==="
input ENUM_AURA_RISK_PRESET   InpRiskPreset   = AURA_PRESET_MEDIUM;
input ENUM_AURA_BROKER_PRESET InpBrokerPreset = AURA_BROKER_IC_RAW;
input int    InpMagic         = 20260901;

input group "=== Money management ==="
input double InpRiskPct       = 0.8;    // Auto-lot risk % (overridden by preset)
input double InpFixedLot      = 0.01;   // Used when auto-lot off
input bool   InpAutoLot       = true;

input group "=== Smart grid (no martingale) ==="
input int    InpMaxGridLevels = 4;
input double InpGridAtrMult   = 0.85;   // Grid step = ATR * mult
input double InpLotStepMult   = 0.15;   // Additive lot scale per level
input double InpMaxLotMult    = 1.45;   // Cap vs base lot
input double InpBasketTpAtr   = 0.55;   // Close basket at avg + ATR fraction
input double InpBasketSlAtr   = 2.8;   // Emergency basket stop (ATR)

input group "=== Safety ==="
input int    InpMaxSpreadPts  = 30;    // Gold spread filter (points)
input int    InpNewsBlockMin  = 40;
input double InpDailyLossPct  = 3.0;
input bool   InpShowPanel     = true;

CTrade g_trade;
AuraFX_ProState g_pro;
AuraFX_BasketStats g_basket;
datetime g_lastBar = 0;
int g_activeStrategy = 0;
string g_strategyName = "Idle";
const string QQN = "AURAFX_QQUEEN";
const int STRATEGY_COUNT = 6;

//+------------------------------------------------------------------+
void ApplyPresets()
  {
   if(InpBrokerPreset == AURA_BROKER_IC_RAW)
     {
      // IC Markets / VT RAW — tight gold spread
     }
   else if(InpBrokerPreset == AURA_BROKER_ROBO_ECN)
     {
      // Slightly wider tolerance handled via spread input default
     }
  }

double EffectiveRiskPct()
  {
   if(InpRiskPreset == AURA_PRESET_LOW) return MathMin(InpRiskPct, 0.5);
   return InpRiskPct;
  }

bool SpreadOk()
  {
   return SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) <= InpMaxSpreadPts;
  }

double GetAtr()
  {
   int h = iATR(_Symbol, PERIOD_CURRENT, 14);
   if(h == INVALID_HANDLE) return 200 * _Point;
   double v[];
   ArraySetAsSeries(v, true);
   if(CopyBuffer(h, 0, 1, 1, v) < 1) { IndicatorRelease(h); return 200 * _Point; }
   IndicatorRelease(h);
   return (v[0] > 0) ? v[0] : 200 * _Point;
  }

//+------------------------------------------------------------------+
//| Strategy 1 — Momentum trend (EMA + MACD)                           |
//+------------------------------------------------------------------+
ENUM_AURA_SIGNAL StratMomentumTrend()
  {
   ENUM_AURA_SIGNAL s = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1, 62, 38, 0.28);
   if(s == AURA_SIGNAL_BUY && g_pro.mtf_agrees_buy)  return AURA_SIGNAL_BUY;
   if(s == AURA_SIGNAL_SELL && g_pro.mtf_agrees_sell) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

//+------------------------------------------------------------------+
//| Strategy 2 — Structure breakout (BOS)                            |
//+------------------------------------------------------------------+
ENUM_AURA_SIGNAL StratStructureBreakout()
  {
   AuraFX_StructureState st;
   AuraFX_AnalyzeStructure(_Symbol, PERIOD_CURRENT, st);
   if(st.bos_up && g_pro.score.trend_strength >= 55) return AURA_SIGNAL_BUY;
   if(st.bos_down && g_pro.score.trend_strength >= 55) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

//+------------------------------------------------------------------+
//| Strategy 3 — Pullback to EMA in trend                            |
//+------------------------------------------------------------------+
ENUM_AURA_SIGNAL StratTrendPullback()
  {
   int hFast = iMA(_Symbol, PERIOD_CURRENT, 21, 0, MODE_EMA, PRICE_CLOSE);
   int hSlow = iMA(_Symbol, PERIOD_CURRENT, 55, 0, MODE_EMA, PRICE_CLOSE);
   int hRsi  = iRSI(_Symbol, PERIOD_CURRENT, 14, PRICE_CLOSE);
   double f[], s[], r[];
   ArraySetAsSeries(f, true); ArraySetAsSeries(s, true); ArraySetAsSeries(r, true);
   if(CopyBuffer(hFast, 0, 1, 2, f) < 2 || CopyBuffer(hSlow, 0, 1, 2, s) < 2 ||
      CopyBuffer(hRsi, 0, 1, 1, r) < 1)
     { IndicatorRelease(hFast); IndicatorRelease(hSlow); IndicatorRelease(hRsi); return AURA_SIGNAL_NONE; }
   IndicatorRelease(hFast); IndicatorRelease(hSlow); IndicatorRelease(hRsi);

   MqlRates bar[];
   if(CopyRates(_Symbol, PERIOD_CURRENT, 1, 1, bar) < 1) return AURA_SIGNAL_NONE;
   bool upTrend = f[0] > s[0];
   bool dnTrend = f[0] < s[0];
   if(upTrend && bar[0].low <= f[0] && r[0] > 42 && r[0] < 58) return AURA_SIGNAL_BUY;
   if(dnTrend && bar[0].high >= f[0] && r[0] < 58 && r[0] > 42) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

//+------------------------------------------------------------------+
//| Strategy 4 — Range fade (RSI extremes)                           |
//+------------------------------------------------------------------+
ENUM_AURA_SIGNAL StratRangeFade()
  {
   int hRsi = iRSI(_Symbol, PERIOD_CURRENT, 14, PRICE_CLOSE);
   double r[];
   ArraySetAsSeries(r, true);
   if(CopyBuffer(hRsi, 0, 1, 1, r) < 1) { IndicatorRelease(hRsi); return AURA_SIGNAL_NONE; }
   IndicatorRelease(hRsi);
   if(r[0] <= 32) return AURA_SIGNAL_BUY;
   if(r[0] >= 68) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

//+------------------------------------------------------------------+
//| Strategy 5 — Volatility breakout                                 |
//+------------------------------------------------------------------+
ENUM_AURA_SIGNAL StratVolBreakout()
  {
   double atr = GetAtr();
   MqlRates r[];
   if(CopyRates(_Symbol, PERIOD_CURRENT, 1, 2, r) < 2) return AURA_SIGNAL_NONE;
   ArraySetAsSeries(r, true);
   double body = MathAbs(r[0].close - r[0].open);
   if(body < atr * 1.1) return AURA_SIGNAL_NONE;
   if(r[0].close > r[0].open && r[0].close > r[1].high) return AURA_SIGNAL_BUY;
   if(r[0].close < r[0].open && r[0].close < r[1].low) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

//+------------------------------------------------------------------+
//| Strategy 6 — Session overlap momentum                              |
//+------------------------------------------------------------------+
ENUM_AURA_SIGNAL StratSessionOverlap()
  {
   if(g_pro.session != AURA_SESSION_OVERLAP && g_pro.session != AURA_SESSION_LONDON)
      return AURA_SIGNAL_NONE;
   return StratMomentumTrend();
  }

//+------------------------------------------------------------------+
ENUM_AURA_SIGNAL PickStrategy()
  {
   ENUM_AURA_SIGNAL sig = AURA_SIGNAL_NONE;

   switch(g_pro.regime)
     {
      case AURA_REGIME_TRENDING:
         g_activeStrategy = 1; g_strategyName = "Momentum Trend";
         sig = StratMomentumTrend();
         break;
      case AURA_REGIME_RANGING:
         g_activeStrategy = 4; g_strategyName = "Range Fade";
         sig = StratRangeFade();
         break;
      case AURA_REGIME_VOLATILE:
         g_activeStrategy = 5; g_strategyName = "Vol Breakout";
         sig = StratVolBreakout();
         break;
      case AURA_REGIME_NEWS_DRIVEN:
         g_activeStrategy = 0; g_strategyName = "News Pause";
         return AURA_SIGNAL_NONE;
      default:
         g_activeStrategy = 3; g_strategyName = "Trend Pullback";
         sig = StratTrendPullback();
         break;
     }

   if(sig != AURA_SIGNAL_NONE) return sig;

   sig = StratStructureBreakout();
   if(sig != AURA_SIGNAL_NONE)
     { g_activeStrategy = 2; g_strategyName = "Structure BOS"; return sig; }

   sig = StratSessionOverlap();
   if(sig != AURA_SIGNAL_NONE)
     { g_activeStrategy = 6; g_strategyName = "Session Overlap"; return sig; }

   g_activeStrategy = 0;
   g_strategyName = "Scanning";
   return AURA_SIGNAL_NONE;
  }

//+------------------------------------------------------------------+
double CalcBaseLot(const double slPrice)
  {
   if(!InpAutoLot) return InpFixedLot;
   double px = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   return AuraFX_CalcRiskLot(_Symbol, EffectiveRiskPct(), px, slPrice,
                             AccountInfoDouble(ACCOUNT_BALANCE));
  }

void OpenLeg(const ENUM_ORDER_TYPE type, const int gridLevel)
  {
   double atr = GetAtr();
   double slDist = atr * InpBasketSlAtr;
   double px = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                        : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = (type == ORDER_TYPE_BUY) ? px - slDist : px + slDist;
   double base = CalcBaseLot(sl);
   double lots = AuraFX_GridLotScale(gridLevel, base, InpLotStepMult, InpMaxLotMult);
   if(lots <= 0) lots = InpFixedLot;
   g_trade.PositionOpen(_Symbol, type, lots, px, 0, 0, "AuraFX Quantum Queen");
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(30);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   ApplyPresets();

   if(AuraFX_DetectAsset(_Symbol) != AURA_ASSET_GOLD)
      Alert("AuraFX Quantum Queen: designed for XAUUSD. Current: ", _Symbol);

   if((ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE) != ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
      Alert("Quantum Queen style grid works best on hedging accounts.");

   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
      Alert("Turn ON Algo Trading (green button) on the chart.");

   return INIT_SUCCEEDED;
  }

void OnDeinit(const int r) { ObjectsDeleteAll(ChartID(), QQN); }

//+------------------------------------------------------------------+
void OnTick()
  {
   datetime bar = iTime(_Symbol, PERIOD_CURRENT, 0);
   bool newBar = (bar != g_lastBar && bar > 0);
   if(newBar) g_lastBar = bar;

   AuraFX_CheckLossLimits(InpDailyLossPct, 6.0, 12.0,
                          g_pro.daily_pnl_pct, g_pro.weekly_pnl_pct,
                          g_pro.trading_locked, g_pro.lock_reason);

   ENUM_AURA_SIGNAL probe = AURA_SIGNAL_NONE;
   AuraFX_ComputeProScore(_Symbol, probe, g_pro, InpNewsBlockMin, 1.5);
   AuraFX_BasketCollect(_Symbol, InpMagic, g_basket);

   double atr = GetAtr();
   double gridStepPts = (atr * InpGridAtrMult) / _Point;
   double basketTpPts = (atr * InpBasketTpAtr) / _Point;
   double basketSlPts = (atr * InpBasketSlAtr) / _Point;

   if(InpShowPanel)
      AuraFX_DrawGridPanel(ChartID(), QQN, 14, 24, g_basket, g_strategyName,
                           g_activeStrategy, STRATEGY_COUNT, SpreadOk(), g_pro.trading_locked);

   // Basket exits
   if(g_basket.count > 0)
     {
      if(AuraFX_BasketTpHit(g_basket, basketTpPts) || AuraFX_BasketSlHit(g_basket, basketSlPts))
        {
         AuraFX_CloseBasket(g_trade, _Symbol, InpMagic);
         return;
        }
     }

   if(g_pro.trading_locked || !SpreadOk() || g_pro.news_block_entry) return;

   ENUM_AURA_SIGNAL sig = PickStrategy();
   if(sig == AURA_SIGNAL_NONE || sig == AURA_SIGNAL_COVER) return;

   ENUM_ORDER_TYPE want = (sig == AURA_SIGNAL_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   ENUM_AURA_GRID_SIDE wantSide = (sig == AURA_SIGNAL_BUY) ? AURA_GRID_BUY : AURA_GRID_SELL;

   // New basket on fresh signal
   if(g_basket.count == 0)
     {
      if(!newBar) return;
      if(g_pro.score.total < 62) return;
      OpenLeg(want, 0);
      return;
     }

   // Smart recovery grid — trend must still agree
   if(g_basket.side == wantSide)
     {
      bool trendOk = (wantSide == AURA_GRID_BUY && g_pro.mtf_agrees_buy) ||
                     (wantSide == AURA_GRID_SELL && g_pro.mtf_agrees_sell);
      if(trendOk && AuraFX_CanAddGrid(g_basket, InpMaxGridLevels, gridStepPts, wantSide))
         OpenLeg(want, g_basket.grid_level + 1);
     }
  }
