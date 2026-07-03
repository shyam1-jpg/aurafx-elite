//+------------------------------------------------------------------+
//| AuraFX_Universal_AI_EA.mq5                                       |
//| Fully automated — forex, gold, silver, indices · any symbol      |
//| AI confidence scoring · breakout · auto SL/TP/close              |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Universal AI EA: auto buy/sell/close, all markets. Demo test first."
#property description "No guaranteed win rate — live stats shown on chart."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_Structure.mqh>
#include <AuraFX_NewsRisk.mqh>
#include <AuraFX_Pro.mqh>
#include <AuraFX_SmartExit.mqh>

enum ENUM_AURA_TRADE_MODE
  {
   AURA_MODE_AGGRESSIVE = 0,  // More signals + breakouts
   AURA_MODE_BALANCED   = 1,
   AURA_MODE_PRECISION  = 2,  // Fewer, stricter trades
   AURA_MODE_ULTRA      = 3   // Maximum trades — demo only
  };

input group "=== Universal AI — Automation ==="
input ENUM_AURA_TRADE_MODE InpTradeMode = AURA_MODE_BALANCED;
input bool   InpFullyAuto        = true;
input bool   InpCloseOnOpposite  = true;
input bool   InpTradeBreakouts   = true;
input int    InpMagic            = 20260815;
input int    InpMaxOpenTrades    = 1;
input bool   InpIgnoreNewsBlock  = false;
input bool   InpIgnoreScoreCheck = false;

input group "=== Markets (any chart symbol) ==="
input bool   InpAllowForex       = true;
input bool   InpAllowGold        = true;
input bool   InpAllowSilver      = true;
input bool   InpAllowIndices     = true;

input group "=== Risk & exits ==="
input double InpRiskPct          = 0.5;
input double InpMinRR            = 1.8;
input int    InpMaxSpreadPts     = 50;
input int    InpMaxSpreadIndex   = 500;
input bool   InpUseTrailing      = true;
input int    InpTrailAtrMult     = 2;
input double InpTrailStartAtr    = 0.35;
input bool   InpUseBreakeven     = true;
input int    InpBE_AtrMult       = 1;
input double InpMaxDailyLossPct  = 2.0;

input group "=== Smart exit (profit lock + cut loss) ==="
input bool   InpSmartExit        = true;
input bool   InpQuickTakeProfit  = true;
input double InpQuickTpAtr       = 1.0;     // Close in profit at this ATR gain
input bool   InpCutLossEarly     = true;
input double InpCutLossAtr       = 0.85;    // Close if loss exceeds this ATR
input bool   InpExitOnOpposite   = true;    // Close on opposite signal (any tick)
input int    InpMaxBarsStuck     = 12;      // Close losing trade after N bars

input group "=== AI / filters ==="
input int    InpNewsBlockMin     = 30;
input bool   InpShowDashboard    = true;

CTrade g_trade;
AuraFX_ProState g_pro;
AuraFX_Stats g_liveStats;
datetime g_lastBar = 0;
ENUM_AURA_SIGNAL g_lastEntrySig = AURA_SIGNAL_NONE;
double g_lastEntryPrice = 0;
const string UFX = "AURAFX_UNIVERSAL";

int g_hAtr = INVALID_HANDLE;

//+------------------------------------------------------------------+
int OnInit()
  {
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(30);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   g_hAtr = iATR(_Symbol, PERIOD_CURRENT, 14);
   g_liveStats.targetRate = 0;
   g_liveStats.total = 0;
   g_liveStats.wins = 0;
   g_liveStats.losses = 0;
   g_liveStats.winRate = 0;

   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
      Alert("AuraFX Universal AI: Algo trading OFF — click green Algo button + allow smiley on chart!");

   return INIT_SUCCEEDED;
  }

void OnDeinit(const int r)
  {
   if(g_hAtr != INVALID_HANDLE) IndicatorRelease(g_hAtr);
   AuraFX_IndCacheReleaseAll();
   ObjectsDeleteAll(ChartID(), UFX);
  }

bool MarketAllowed()
  {
   ENUM_AURA_ASSET a = AuraFX_DetectAsset(_Symbol);
   if(a == AURA_ASSET_GOLD && !InpAllowGold) return false;
   if(a == AURA_ASSET_SILVER && !InpAllowSilver) return false;
   if(a == AURA_ASSET_INDEX && !InpAllowIndices) return false;
   if(a == AURA_ASSET_FOREX && !InpAllowForex) return false;
   return true;
  }

int MinScore()
  {
   if(InpTradeMode == AURA_MODE_ULTRA) return 35;
   if(InpTradeMode == AURA_MODE_AGGRESSIVE) return 55;
   if(InpTradeMode == AURA_MODE_PRECISION) return 78;
   return 68;
  }

double AtrPoints()
  {
   if(g_hAtr == INVALID_HANDLE) return 100 * _Point;
   double v = AuraFX_Buffer(g_hAtr, 0, 0);
   if(v <= 0) return 100 * _Point;
   return v;
  }

bool SpreadOk()
  {
   ENUM_AURA_ASSET a = AuraFX_DetectAsset(_Symbol);
   int maxSp = (a == AURA_ASSET_INDEX) ? InpMaxSpreadIndex : InpMaxSpreadPts;
   if(InpTradeMode == AURA_MODE_ULTRA)
      maxSp = (int)(maxSp * 1.5);
   return (SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) <= maxSp);
  }

ENUM_AURA_SIGNAL SimpleMomentumSignal()
  {
   int hF = AuraFX_CacheMA(_Symbol, PERIOD_CURRENT, 8);
   int hS = AuraFX_CacheMA(_Symbol, PERIOD_CURRENT, 21);
   if(hF == INVALID_HANDLE || hS == INVALID_HANDLE) return AURA_SIGNAL_NONE;
   double f0 = AuraFX_Buffer(hF, 0, 1), f1 = AuraFX_Buffer(hF, 0, 2);
   double s0 = AuraFX_Buffer(hS, 0, 1), s1 = AuraFX_Buffer(hS, 0, 2);
   if(f0 > s0 && f1 <= s1) return AURA_SIGNAL_BUY;
   if(f0 < s0 && f1 >= s1) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

ENUM_AURA_SIGNAL FusionSignal()
  {
   double atrMult = 0.35;
   if(InpTradeMode == AURA_MODE_ULTRA) atrMult = 0.10;
   else if(InpTradeMode == AURA_MODE_AGGRESSIVE) atrMult = 0.18;

   double rsiBuy = (InpTradeMode == AURA_MODE_ULTRA) ? 72.0 : 66.0;
   double rsiSell = (InpTradeMode == AURA_MODE_ULTRA) ? 28.0 : 34.0;
   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1, rsiBuy, rsiSell, atrMult);

   AuraFX_StructureState st;
   AuraFX_AnalyzeStructure(_Symbol, PERIOD_CURRENT, st);

   if(InpTradeBreakouts)
     {
      if(st.bos_up && sig != AURA_SIGNAL_SELL)
         sig = AURA_SIGNAL_BUY;
      else if(st.bos_down && sig != AURA_SIGNAL_BUY)
         sig = AURA_SIGNAL_SELL;
     }

   if((InpTradeMode == AURA_MODE_AGGRESSIVE || InpTradeMode == AURA_MODE_ULTRA) && sig == AURA_SIGNAL_NONE)
     {
      if(st.bullish_fvg || st.stop_hunt_low) sig = AURA_SIGNAL_BUY;
      if(st.bearish_fvg || st.stop_hunt_high) sig = AURA_SIGNAL_SELL;
     }

   if(InpTradeMode == AURA_MODE_ULTRA && sig == AURA_SIGNAL_NONE)
      sig = SimpleMomentumSignal();

   return sig;
  }

bool AllowsEntry(const ENUM_AURA_SIGNAL sig)
  {
   if(!InpFullyAuto || sig == AURA_SIGNAL_NONE || sig == AURA_SIGNAL_COVER) return false;
   if(!MarketAllowed()) return false;
   if(!SpreadOk()) return false;
   if(g_pro.trading_locked) return false;
   if(!InpIgnoreNewsBlock && g_pro.news_block_entry) return false;
   if(!InpIgnoreScoreCheck && g_pro.score.total < MinScore()) return false;
   if(g_pro.rr_ratio < InpMinRR && InpTradeMode != AURA_MODE_AGGRESSIVE && InpTradeMode != AURA_MODE_ULTRA) return false;
   if(sig == AURA_SIGNAL_BUY && !g_pro.mtf_agrees_buy && InpTradeMode == AURA_MODE_PRECISION) return false;
   if(sig == AURA_SIGNAL_SELL && !g_pro.mtf_agrees_sell && InpTradeMode == AURA_MODE_PRECISION) return false;
   return true;
  }

void UpdateLiveStats()
  {
   if(g_lastEntrySig == AURA_SIGNAL_NONE || g_lastEntryPrice <= 0) return;
   double px = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   bool closed = (CountPositions() == 0);
   if(!closed) return;
   AuraFX_UpdateStats(g_liveStats, g_lastEntrySig, g_lastEntryPrice, px, 0);
   g_lastEntrySig = AURA_SIGNAL_NONE;
   g_lastEntryPrice = 0;
  }

void DrawUniversalPanel(const ENUM_AURA_SIGNAL sig)
  {
   ENUM_AURA_ASSET asset = AuraFX_DetectAsset(_Symbol);
   AuraFX_DrawPanel(ChartID(), UFX, 14, 24, sig, g_liveStats, _Symbol, asset);

   string ai = UFX + "_ai";
   if(ObjectFind(ChartID(), ai) < 0)
     {
      ObjectCreate(ChartID(), ai, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), ai, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetString(ChartID(), ai, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(ChartID(), ai, OBJPROP_FONTSIZE, 9);
      ObjectSetInteger(ChartID(), ai, OBJPROP_COLOR, AURA_COLOR_GOLD);
     }
   ObjectSetInteger(ChartID(), ai, OBJPROP_XDISTANCE, 28);
   ObjectSetInteger(ChartID(), ai, OBJPROP_YDISTANCE, 200);
   string modeTxt = (InpTradeMode == AURA_MODE_ULTRA) ? "ULTRA" :
                    (InpTradeMode == AURA_MODE_AGGRESSIVE) ? "AGGRESSIVE" :
                    (InpTradeMode == AURA_MODE_PRECISION) ? "PRECISION" : "BALANCED";
   ObjectSetString(ChartID(), ai, OBJPROP_TEXT,
      StringFormat("AI confidence: %d%% · %s · Live WR: %.1f%% (%d trades)",
                   g_pro.score.total, modeTxt, g_liveStats.winRate, g_liveStats.total));
   string trailTxt = "Trail: waiting for profit";
   if(CountPositions() > 0)
     {
      double atr = AtrPoints();
      for(int p = PositionsTotal() - 1; p >= 0; p--)
        {
         if(!PositionSelectByTicket(PositionGetTicket(p))) continue;
         if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
         if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
         bool isBuy = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY;
         double op = PositionGetDouble(POSITION_PRICE_OPEN);
         double sl = PositionGetDouble(POSITION_SL);
         double px = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double profitDist = isBuy ? (px - op) : (op - px);
         if(!InpUseTrailing) trailTxt = "Trail: OFF in settings";
         else if(profitDist < atr * InpTrailStartAtr)
            trailTxt = StringFormat("Trail: armed at +%.0f pts profit", atr * InpTrailStartAtr / _Point);
         else
            trailTxt = StringFormat("Trail: ACTIVE · SL @ %.5f", sl);
         break;
        }
     }
   string status = UFX + "_status";
   if(ObjectFind(ChartID(), status) < 0)
     {
      ObjectCreate(ChartID(), status, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), status, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetString(ChartID(), status, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(ChartID(), status, OBJPROP_FONTSIZE, 9);
      ObjectSetInteger(ChartID(), status, OBJPROP_COLOR, AURA_COLOR_COVER);
     }
   ObjectSetInteger(ChartID(), status, OBJPROP_XDISTANCE, 28);
   ObjectSetInteger(ChartID(), status, OBJPROP_YDISTANCE, 244);
   ObjectSetString(ChartID(), status, OBJPROP_TEXT, trailTxt);

   string disc = UFX + "_disc";
   if(ObjectFind(ChartID(), disc) < 0)
     {
      ObjectCreate(ChartID(), disc, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), disc, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetString(ChartID(), disc, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(ChartID(), disc, OBJPROP_FONTSIZE, 8);
      ObjectSetInteger(ChartID(), disc, OBJPROP_COLOR, AURA_COLOR_MUTED);
     }
   ObjectSetInteger(ChartID(), disc, OBJPROP_XDISTANCE, 28);
   ObjectSetInteger(ChartID(), disc, OBJPROP_YDISTANCE, 266);
   ObjectSetString(ChartID(), disc, OBJPROP_TEXT,
      "Demo practice · Smart Exit ON · Not guaranteed profit");
   ChartRedraw();
  }

void ManageExits(const ENUM_AURA_SIGNAL sig)
  {
   double atr = AtrPoints();
   if(InpSmartExit)
     {
      AuraFX_SmartManageExits(g_trade, _Symbol, InpMagic, atr, sig,
                              InpUseBreakeven, InpBE_AtrMult * 0.5,
                              InpUseTrailing, InpTrailStartAtr, InpTrailAtrMult,
                              InpQuickTakeProfit, InpQuickTpAtr,
                              InpCutLossEarly, InpCutLossAtr,
                              InpExitOnOpposite, InpMaxBarsStuck, PERIOD_CURRENT);
      return;
     }
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
      double profitDist = isBuy ? (px - op) : (op - px);

      if(InpUseBreakeven && profitDist >= atr * InpBE_AtrMult)
        {
         double be = isBuy ? op + 5 * _Point : op - 5 * _Point;
         if(isBuy && sl < be) g_trade.PositionModify(t, be, tp);
         if(!isBuy && (sl == 0 || sl > be)) g_trade.PositionModify(t, be, tp);
        }
      if(InpUseTrailing && profitDist >= atr * InpTrailStartAtr)
        {
         double trail = atr * InpTrailAtrMult;
         double nsl = isBuy ? px - trail : px + trail;
         if(isBuy && nsl > sl) g_trade.PositionModify(t, nsl, tp);
         if(!isBuy && (sl == 0 || nsl < sl)) g_trade.PositionModify(t, nsl, tp);
        }
     }
  }

int CountPositions()
  {
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!PositionSelectByTicket(PositionGetTicket(i))) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      n++;
     }
   return n;
  }

void CloseAll()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      g_trade.PositionClose(t);
     }
  }

void OpenTrade(const ENUM_AURA_SIGNAL sig)
  {
   ENUM_ORDER_TYPE type = (sig == AURA_SIGNAL_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   double price = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                           : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double lots = AuraFX_CalcRiskLot(_Symbol, InpRiskPct, price, g_pro.suggested_sl,
                                    AccountInfoDouble(ACCOUNT_BALANCE));
   if(lots <= 0) lots = 0.01;

   if(g_trade.PositionOpen(_Symbol, type, lots, price, g_pro.suggested_sl, g_pro.suggested_tp,
                           "AuraFX Universal AI"))
     {
      g_lastEntrySig = sig;
      g_lastEntryPrice = price;
     }
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   datetime bar = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(bar == 0) return;
   bool newBar = (bar != g_lastBar);
   if(newBar) g_lastBar = bar;

   UpdateLiveStats();

   ENUM_AURA_SIGNAL sig = FusionSignal();

   AuraFX_CheckLossLimits(InpMaxDailyLossPct, 7.0, 12.0,
                          g_pro.daily_pnl_pct, g_pro.weekly_pnl_pct,
                          g_pro.trading_locked, g_pro.lock_reason);
   AuraFX_ComputeProScore(_Symbol, sig, g_pro, InpNewsBlockMin, InpMinRR);

   if(InpShowDashboard)
      DrawUniversalPanel(sig);

   ManageExits(sig);

   if(sig == AURA_SIGNAL_COVER)
     {
      CloseAll();
      return;
     }

   if(!newBar) return;

   if(CountPositions() > 0 && InpCloseOnOpposite)
     {
      bool hasBuy = false, hasSell = false;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         if(!PositionSelectByTicket(PositionGetTicket(i))) continue;
         if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
         if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) hasBuy = true;
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL) hasSell = true;
        }
      if(hasBuy && sig == AURA_SIGNAL_SELL) CloseAll();
      if(hasSell && sig == AURA_SIGNAL_BUY) CloseAll();
     }

   if(!AllowsEntry(sig)) return;
   if(CountPositions() >= InpMaxOpenTrades) return;

   OpenTrade(sig);
  }
