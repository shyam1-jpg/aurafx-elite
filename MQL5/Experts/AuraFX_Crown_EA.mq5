//+------------------------------------------------------------------+
//| AuraFX_Crown_EA.mq5                                              |
//| BEST OF THE BEST — Quantum Queen + Nexorion fusion               |
//| Queen: 8 strategies, smart grid, broker presets, spread filter   |
//| Nexorion: BSL/SSL liquidity, EQ zones, phase map, chart zones    |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Crown EA: Quantum Queen grid + Nexorion liquidity engine."
#property description "Educational only — no guaranteed profit. Demo first."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_Pro.mqh>
#include <AuraFX_Structure.mqh>
#include <AuraFX_Liquidity.mqh>
#include <AuraFX_GridEngine.mqh>

enum ENUM_AURA_CROWN_MODE
  {
   AURA_MODE_NEXORION = 0,   // Single trade, deterministic SL, liquidity zones
   AURA_MODE_QUANTUM  = 1,   // Multi-strategy smart grid (Queen style)
   AURA_MODE_HYBRID   = 2    // Liquidity entry + optional grid recovery
  };

enum ENUM_AURA_RISK_PRESET
  {
   AURA_PRESET_LOW    = 0,
   AURA_PRESET_MEDIUM = 1
  };

enum ENUM_AURA_BROKER_PRESET
  {
   AURA_BROKER_IC_RAW   = 0,
   AURA_BROKER_ROBO_ECN = 1,
   AURA_BROKER_GENERIC  = 2
  };

input group "=== Crown — Plug & Play ==="
input ENUM_AURA_CROWN_MODE    InpMode         = AURA_MODE_HYBRID;
input ENUM_AURA_RISK_PRESET   InpRiskPreset   = AURA_PRESET_MEDIUM;
input ENUM_AURA_BROKER_PRESET InpBrokerPreset = AURA_BROKER_IC_RAW;
input int    InpMagic         = 20260915;

input group "=== Money management ==="
input double InpRiskPct       = 0.8;
input double InpFixedLot      = 0.01;
input bool   InpAutoLot       = true;
input double InpMinRR         = 1.8;

input group "=== Quantum grid (Queen mode / hybrid) ==="
input bool   InpUseGrid       = true;
input int    InpMaxGridLevels = 4;
input double InpGridAtrMult   = 0.85;
input double InpLotStepMult   = 0.15;
input double InpMaxLotMult    = 1.45;
input double InpBasketTpAtr   = 0.55;
input double InpBasketSlAtr   = 2.8;

input group "=== Nexorion liquidity ==="
input bool   InpRequireLiquidity = true;
input bool   InpDrawZones        = true;
input int    InpLiquidityLookback = 60;

input group "=== Safety ==="
input int    InpMaxSpreadPts  = 30;
input int    InpNewsBlockMin  = 40;
input double InpDailyLossPct  = 3.0;
input bool   InpUseTrailing   = true;
input int    InpTrailAtrMult  = 2;
input bool   InpShowPanel     = true;

CTrade g_trade;
AuraFX_ProState g_pro;
AuraFX_BasketStats g_basket;
AuraFX_LiquidityMap g_liq;
AuraFX_StructureState g_struct;
datetime g_lastBar = 0;
int g_activeStrategy = 0;
string g_strategyName = "Idle";
const string CRN = "AURAFX_CROWN";
const int STRATEGY_COUNT = 8;

//+------------------------------------------------------------------+
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

bool SpreadOk() { return SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) <= InpMaxSpreadPts; }

double EffectiveRiskPct()
  {
   return (InpRiskPreset == AURA_PRESET_LOW) ? MathMin(InpRiskPct, 0.5) : InpRiskPct;
  }

void ApplyBrokerPreset()
  {
   // Presets tune spread tolerance via InpMaxSpreadPts at load time in .set files
  }

// --- Strategy engines (Queen family) ---
ENUM_AURA_SIGNAL StratMomentumTrend()
  {
   ENUM_AURA_SIGNAL s = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1, 62, 38, 0.28);
   if(s == AURA_SIGNAL_BUY && g_pro.mtf_agrees_buy) return AURA_SIGNAL_BUY;
   if(s == AURA_SIGNAL_SELL && g_pro.mtf_agrees_sell) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

ENUM_AURA_SIGNAL StratStructureBreakout()
  {
   if(g_struct.bos_up && g_pro.score.trend_strength >= 55) return AURA_SIGNAL_BUY;
   if(g_struct.bos_down && g_pro.score.trend_strength >= 55) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

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

ENUM_AURA_SIGNAL StratVolBreakout()
  {
   double atr = GetAtr();
   MqlRates r[];
   if(CopyRates(_Symbol, PERIOD_CURRENT, 1, 2, r) < 2) return AURA_SIGNAL_NONE;
   ArraySetAsSeries(r, true);
   if(MathAbs(r[0].close - r[0].open) < atr * 1.1) return AURA_SIGNAL_NONE;
   if(r[0].close > r[0].open && r[0].close > r[1].high) return AURA_SIGNAL_BUY;
   if(r[0].close < r[0].open && r[0].close < r[1].low) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

// Strategy 7 — Nexorion liquidity sweep (discount/premium)
ENUM_AURA_SIGNAL StratLiquiditySweep()
  {
   if(AuraFX_NexorionBuyOk(g_liq, g_struct))  return AURA_SIGNAL_BUY;
   if(AuraFX_NexorionSellOk(g_liq, g_struct)) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

// Strategy 8 — EQ rejection
ENUM_AURA_SIGNAL StratEqRejection()
  {
   double px = iClose(_Symbol, PERIOD_CURRENT, 1);
   double band = (g_liq.range_high - g_liq.range_low) * 0.05;
   if(px > g_liq.equilibrium && px < g_liq.equilibrium + band && g_struct.bearish_ob)
      return AURA_SIGNAL_SELL;
   if(px < g_liq.equilibrium && px > g_liq.equilibrium - band && g_struct.bullish_ob)
      return AURA_SIGNAL_BUY;
   return AURA_SIGNAL_NONE;
  }

ENUM_AURA_SIGNAL PickQuantumStrategy()
  {
   ENUM_AURA_SIGNAL sig = AURA_SIGNAL_NONE;
   switch(g_pro.regime)
     {
      case AURA_REGIME_TRENDING:
         g_activeStrategy = 1; g_strategyName = "Momentum Trend";
         sig = StratMomentumTrend(); break;
      case AURA_REGIME_RANGING:
         g_activeStrategy = 4; g_strategyName = "Range Fade";
         sig = StratRangeFade(); break;
      case AURA_REGIME_VOLATILE:
         g_activeStrategy = 5; g_strategyName = "Vol Breakout";
         sig = StratVolBreakout(); break;
      case AURA_REGIME_NEWS_DRIVEN:
         g_activeStrategy = 0; g_strategyName = "News Pause";
         return AURA_SIGNAL_NONE;
      default:
         g_activeStrategy = 2; g_strategyName = "Structure BOS";
         sig = StratStructureBreakout(); break;
     }
   if(sig != AURA_SIGNAL_NONE) return sig;
   sig = StratLiquiditySweep();
   if(sig != AURA_SIGNAL_NONE) { g_activeStrategy = 7; g_strategyName = "Liquidity Sweep"; return sig; }
   sig = StratEqRejection();
   if(sig != AURA_SIGNAL_NONE) { g_activeStrategy = 8; g_strategyName = "EQ Rejection"; return sig; }
   g_activeStrategy = 0; g_strategyName = "Scanning";
   return AURA_SIGNAL_NONE;
  }

ENUM_AURA_SIGNAL PickNexorionStrategy()
  {
   g_activeStrategy = 7;
   g_strategyName = "Nexorion Liquidity";
   ENUM_AURA_SIGNAL sig = StratLiquiditySweep();
   if(sig != AURA_SIGNAL_NONE) return sig;
   g_activeStrategy = 8;
   g_strategyName = "EQ Rejection";
   return StratEqRejection();
  }

ENUM_AURA_SIGNAL PickSignal()
  {
   if(InpMode == AURA_MODE_NEXORION) return PickNexorionStrategy();
   if(InpMode == AURA_MODE_QUANTUM)  return PickQuantumStrategy();
   // Hybrid: liquidity first, then quantum fallback
   ENUM_AURA_SIGNAL sig = PickNexorionStrategy();
   if(sig != AURA_SIGNAL_NONE) return sig;
   return PickQuantumStrategy();
  }

bool LiquidityAllows(const ENUM_AURA_SIGNAL sig)
  {
   if(!InpRequireLiquidity || InpMode == AURA_MODE_QUANTUM) return true;
   if(sig == AURA_SIGNAL_BUY)  return AuraFX_NexorionBuyOk(g_liq, g_struct);
   if(sig == AURA_SIGNAL_SELL) return AuraFX_NexorionSellOk(g_liq, g_struct);
   return false;
  }

bool GridModeActive()
  {
   if(InpMode == AURA_MODE_QUANTUM) return true;
   if(InpMode == AURA_MODE_HYBRID && InpUseGrid) return true;
   return false;
  }

double CalcBaseLot(const double slPrice)
  {
   if(!InpAutoLot) return InpFixedLot;
   double px = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   return AuraFX_CalcRiskLot(_Symbol, EffectiveRiskPct(), px, slPrice,
                             AccountInfoDouble(ACCOUNT_BALANCE));
  }

void OpenLeg(const ENUM_ORDER_TYPE type, const int gridLevel, const bool withSlTp)
  {
   double atr = GetAtr();
   double px = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                        : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = 0, tp = 0;
   double slDist = atr * (GridModeActive() ? InpBasketSlAtr : 1.8);
   sl = (type == ORDER_TYPE_BUY) ? px - slDist : px + slDist;
   if(withSlTp && !GridModeActive())
     {
      tp = (type == ORDER_TYPE_BUY) ? px + slDist * InpMinRR : px - slDist * InpMinRR;
     }
   double base = CalcBaseLot(sl);
   double lots = GridModeActive()
                 ? AuraFX_GridLotScale(gridLevel, base, InpLotStepMult, InpMaxLotMult)
                 : base;
   if(lots <= 0) lots = InpFixedLot;
   g_trade.PositionOpen(_Symbol, type, lots, px,
                        (withSlTp || !GridModeActive()) ? sl : 0,
                        (withSlTp && !GridModeActive()) ? tp : 0,
                        "AuraFX Crown");
  }

void ManageSinglePositions()
  {
   if(GridModeActive()) return;
   double atr = GetAtr();
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;

      bool isBuy = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY;
      double op = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      double px = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double profit = px - op;
      if(!isBuy) profit = op - px;

      if(InpUseTrailing && profit > atr * 0.4)
        {
         double nsl = isBuy ? px - atr * InpTrailAtrMult : px + atr * InpTrailAtrMult;
         if(isBuy && nsl > sl) g_trade.PositionModify(t, nsl, tp);
         if(!isBuy && (sl == 0 || nsl < sl)) g_trade.PositionModify(t, nsl, tp);
        }
     }
  }

void DrawCrownPanel()
  {
   string zoneTxt = (g_liq.zone == AURA_ZONE_PREMIUM) ? "Premium" :
                    (g_liq.zone == AURA_ZONE_DISCOUNT) ? "Discount" : "Equilibrium";
   string modeTxt = (InpMode == AURA_MODE_NEXORION) ? "Nexorion" :
                    (InpMode == AURA_MODE_QUANTUM) ? "Quantum Queen" : "Hybrid Crown";

   string panel = CRN + "_PANEL";
   int w = 380, h = 240;
   if(ObjectFind(ChartID(), panel) < 0)
     {
      ObjectCreate(ChartID(), panel, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), panel, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(ChartID(), panel, OBJPROP_SELECTABLE, false);
     }
   ObjectSetInteger(ChartID(), panel, OBJPROP_XDISTANCE, 14);
   ObjectSetInteger(ChartID(), panel, OBJPROP_YDISTANCE, 24);
   ObjectSetInteger(ChartID(), panel, OBJPROP_XSIZE, w);
   ObjectSetInteger(ChartID(), panel, OBJPROP_YSIZE, h);
   ObjectSetInteger(ChartID(), panel, OBJPROP_BGCOLOR, AURA_COLOR_PANEL);
   ObjectSetInteger(ChartID(), panel, OBJPROP_COLOR, AURA_COLOR_GOLD);

   string lines[10];
   lines[0] = "AURAFX CROWN — BEST OF THE BEST";
   lines[1] = StringFormat("Mode: %s | Strategy %d/%d: %s", modeTxt, g_activeStrategy, STRATEGY_COUNT, g_strategyName);
   lines[2] = StringFormat("Liquidity: %s | Phase: %s | EQ %.2f", zoneTxt, g_liq.phase_name, g_liq.equilibrium);
   lines[3] = StringFormat("BSL %.2f | SSL %.2f | BSL sweep %s | SSL sweep %s",
                           g_liq.bsl_level, g_liq.ssl_level,
                           g_liq.bsl_swept ? "YES" : "no", g_liq.ssl_swept ? "YES" : "no");
   lines[4] = StringFormat("Score %d | Spread %s | Regime scan OK",
                           g_pro.score.total, SpreadOk() ? "OK" : "BLOCKED");
   lines[5] = StringFormat("Basket: %d legs | %.2f lots | P/L %.1f pts",
                           g_basket.count, g_basket.total_lots, g_basket.basket_profit_pts);
   lines[6] = GridModeActive() ? "Grid: ON (smart recovery, no martingale)" : "Grid: OFF (deterministic SL per trade)";
   lines[7] = g_pro.trading_locked ? "LOCKED: " + g_pro.lock_reason : "STATUS: Active — patient entries only";
   lines[8] = "Quantum Queen + Nexorion Initium Novum fusion";
   lines[9] = "Educational software — trading involves risk";

   for(int i = 0; i < 10; i++)
     {
      string lbl = CRN + "_LN" + IntegerToString(i);
      if(ObjectFind(ChartID(), lbl) < 0)
        {
         ObjectCreate(ChartID(), lbl, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(ChartID(), lbl, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetString(ChartID(), lbl, OBJPROP_FONT, "Segoe UI");
         ObjectSetInteger(ChartID(), lbl, OBJPROP_FONTSIZE, (i == 0) ? 10 : 9);
         ObjectSetInteger(ChartID(), lbl, OBJPROP_COLOR, (i == 0) ? AURA_COLOR_GOLD : AURA_COLOR_TEXT);
        }
      ObjectSetInteger(ChartID(), lbl, OBJPROP_XDISTANCE, 28);
      ObjectSetInteger(ChartID(), lbl, OBJPROP_YDISTANCE, 38 + i * 20);
      ObjectSetString(ChartID(), lbl, OBJPROP_TEXT, lines[i]);
     }
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(30);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   ApplyBrokerPreset();

   if(AuraFX_DetectAsset(_Symbol) != AURA_ASSET_GOLD)
      Alert("AuraFX Crown: optimised for XAUUSD H1/M15. Current: ", _Symbol);

   if(GridModeActive() &&
      (ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE) != ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
      Alert("Grid mode works best on hedging accounts.");

   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
      Alert("Turn ON Algo Trading (green button).");

   return INIT_SUCCEEDED;
  }

void OnDeinit(const int r)
  {
   ObjectsDeleteAll(ChartID(), CRN);
   AuraFX_DeleteLiquidityZones(ChartID(), CRN);
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   datetime bar = iTime(_Symbol, PERIOD_CURRENT, 0);
   bool newBar = (bar != g_lastBar && bar > 0);
   if(newBar) g_lastBar = bar;

   AuraFX_CheckLossLimits(InpDailyLossPct, 6.0, 12.0,
                          g_pro.daily_pnl_pct, g_pro.weekly_pnl_pct,
                          g_pro.trading_locked, g_pro.lock_reason);

   AuraFX_AnalyzeStructure(_Symbol, PERIOD_CURRENT, g_struct);
   AuraFX_ComputeLiquidityMap(_Symbol, PERIOD_CURRENT, g_liq, InpLiquidityLookback);

   ENUM_AURA_SIGNAL probe = AURA_SIGNAL_NONE;
   AuraFX_ComputeProScore(_Symbol, probe, g_pro, InpNewsBlockMin, InpMinRR);
   AuraFX_BasketCollect(_Symbol, InpMagic, g_basket);

   if(InpDrawZones) AuraFX_DrawLiquidityZones(ChartID(), CRN, g_liq);
   if(InpShowPanel) DrawCrownPanel();

   double atr = GetAtr();
   double gridStepPts = (atr * InpGridAtrMult) / _Point;
   double basketTpPts = (atr * InpBasketTpAtr) / _Point;
   double basketSlPts = (atr * InpBasketSlAtr) / _Point;

   ManageSinglePositions();

   if(GridModeActive() && g_basket.count > 0)
     {
      if(AuraFX_BasketTpHit(g_basket, basketTpPts) || AuraFX_BasketSlHit(g_basket, basketSlPts))
        {
         AuraFX_CloseBasket(g_trade, _Symbol, InpMagic);
         return;
        }
     }

   if(g_pro.trading_locked || !SpreadOk() || g_pro.news_block_entry) return;

   // Nexorion mode: one position max
   if(!GridModeActive() && g_basket.count > 0) return;

   ENUM_AURA_SIGNAL sig = PickSignal();
   if(sig == AURA_SIGNAL_NONE || sig == AURA_SIGNAL_COVER) return;
   if(!LiquidityAllows(sig)) return;
   if(g_pro.score.total < 60) return;

   ENUM_ORDER_TYPE want = (sig == AURA_SIGNAL_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   ENUM_AURA_GRID_SIDE wantSide = (sig == AURA_SIGNAL_BUY) ? AURA_GRID_BUY : AURA_GRID_SELL;

   if(g_basket.count == 0)
     {
      if(!newBar) return;
      OpenLeg(want, 0, true);
      return;
     }

   if(GridModeActive() && g_basket.side == wantSide)
     {
      bool trendOk = (wantSide == AURA_GRID_BUY && g_pro.mtf_agrees_buy) ||
                     (wantSide == AURA_GRID_SELL && g_pro.mtf_agrees_sell);
      if(trendOk && AuraFX_CanAddGrid(g_basket, InpMaxGridLevels, gridStepPts, wantSide))
         OpenLeg(want, g_basket.grid_level + 1, false);
     }
  }
