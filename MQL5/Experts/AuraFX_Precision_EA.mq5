//+------------------------------------------------------------------+
//| AuraFX_Precision_EA.mq5                                          |
//| Flagship EA — cached engine, checklist, smart exits, one trade   |
//| Recommended: XAUUSD H1 · demo first · Algo Trading ON            |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Precision EA: strict entries, smart profit/loss exits."
#property description "No guaranteed profit — use demo to learn."

#include <Trade\Trade.mqh>
#include <AuraFX_Engine.mqh>

input group "=== Precision EA ==="
input int    InpMagic            = 20260830;
input double InpRiskPct          = 0.3;
input double InpMinRR            = 2.0;
input int    InpMinScore         = 75;
input bool   InpRequireChecklist = true;
input int    InpMaxSpreadPts     = 40;
input int    InpNewsBlockMin     = 45;
input double InpMaxDailyLossPct  = 2.0;

input group "=== Smart exits ==="
input bool   InpSmartExit        = true;
input bool   InpQuickTakeProfit  = true;
input double InpQuickTpAtr       = 0.9;
input bool   InpCutLossEarly     = true;
input double InpCutLossAtr       = 0.75;
input bool   InpExitOnOpposite   = true;
input int    InpMaxBarsStuck     = 10;
input bool   InpUseTrailing      = true;
input int    InpTrailAtrMult     = 2;
input double InpTrailStartAtr    = 0.4;
input bool   InpUseBreakeven     = true;
input int    InpBE_AtrMult       = 1;

input group "=== Display ==="
input bool   InpShowDashboard    = true;

CTrade g_trade;
AuraFX_ProState g_pro;
AuraFX_Stats g_liveStats;
datetime g_lastBar = 0;
ENUM_AURA_SIGNAL g_lastEntrySig = AURA_SIGNAL_NONE;
double g_lastEntryPrice = 0;
const string PFX = "AURAFX_PRECISION";

//+------------------------------------------------------------------+
int OnInit()
  {
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(30);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   g_liveStats.targetRate = 0;
   g_liveStats.total = 0;
   g_liveStats.wins = 0;
   g_liveStats.losses = 0;
   g_liveStats.winRate = 0;

   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
      Alert("AuraFX Precision: turn ON Algo Trading (green button) + smiley on chart!");

   return INIT_SUCCEEDED;
  }

void OnDeinit(const int r)
  {
   AuraFX_IndCacheReleaseAll();
   ObjectsDeleteAll(ChartID(), PFX);
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

void UpdateLiveStats()
  {
   if(g_lastEntrySig == AURA_SIGNAL_NONE || g_lastEntryPrice <= 0) return;
   if(CountPositions() > 0) return;
   double px = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   AuraFX_UpdateStats(g_liveStats, g_lastEntrySig, g_lastEntryPrice, px, 0);
   g_lastEntrySig = AURA_SIGNAL_NONE;
   g_lastEntryPrice = 0;
  }

void DrawPanel(const ENUM_AURA_SIGNAL sig)
  {
   ENUM_AURA_ASSET asset = AuraFX_DetectAsset(_Symbol);
   AuraFX_DrawPanel(ChartID(), PFX, 14, 24, sig, g_liveStats, _Symbol, asset);

   string sub = PFX + "_sub";
   if(ObjectFind(ChartID(), sub) < 0)
     {
      ObjectCreate(ChartID(), sub, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), sub, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetString(ChartID(), sub, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(ChartID(), sub, OBJPROP_FONTSIZE, 9);
      ObjectSetInteger(ChartID(), sub, OBJPROP_COLOR, AURA_COLOR_GOLD);
     }
   ObjectSetInteger(ChartID(), sub, OBJPROP_XDISTANCE, 28);
   ObjectSetInteger(ChartID(), sub, OBJPROP_YDISTANCE, 200);
   ObjectSetString(ChartID(), sub, OBJPROP_TEXT,
      StringFormat("Precision · Score %d · Checklist %d/%d · WR %.1f%%",
                   g_pro.score.total, g_pro.checklist.passed, g_pro.checklist.total,
                   g_liveStats.winRate));
   ChartRedraw();
  }

void ManageExits(const ENUM_AURA_SIGNAL sig)
  {
   double atr = AuraFX_EngineAtr(_Symbol, PERIOD_CURRENT);
   if(InpSmartExit)
     {
      AuraFX_SmartManageExits(g_trade, _Symbol, InpMagic, atr, sig,
                              InpUseBreakeven, InpBE_AtrMult * 0.5,
                              InpUseTrailing, InpTrailStartAtr, InpTrailAtrMult,
                              InpQuickTakeProfit, InpQuickTpAtr,
                              InpCutLossEarly, InpCutLossAtr,
                              InpExitOnOpposite, InpMaxBarsStuck, PERIOD_CURRENT);
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
                           "AuraFX Precision"))
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

   ENUM_AURA_SIGNAL sig = AuraFX_PrecisionFusion(_Symbol, PERIOD_CURRENT, 0.42, 62.0, 38.0);

   AuraFX_CheckLossLimits(InpMaxDailyLossPct, 5.0, 10.0,
                          g_pro.daily_pnl_pct, g_pro.weekly_pnl_pct,
                          g_pro.trading_locked, g_pro.lock_reason);
   AuraFX_ComputeProScore(_Symbol, sig, g_pro, InpNewsBlockMin, InpMinRR);

   if(InpShowDashboard)
      DrawPanel(sig);

   ManageExits(sig);

   if(sig == AURA_SIGNAL_COVER)
     {
      CloseAll();
      return;
     }

   if(!newBar) return;
   if(!AuraFX_SpreadOk(_Symbol, InpMaxSpreadPts)) return;
   if(!AuraFX_PrecisionAllowsEntry(sig, g_pro, InpMinScore, InpMinRR, InpRequireChecklist)) return;
   if(CountPositions() >= 1) return;

   OpenTrade(sig);
  }
