//+------------------------------------------------------------------+
//| AuraFX_Quantum_Elite_EA.mq5                                      |
//| Flagship gold & forex EA — 5-layer validation, pro dashboard     |
//| Inspired by top MQL5 sellers — original Aura Elite FX engine      |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Quantum Elite: XAUUSD specialist, 5-layer filter, no grid/martingale."
#property description "Educational software — trading involves risk. No guaranteed results."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_NewsRisk.mqh>
#include <AuraFX_Pro.mqh>

input group "=== Aura Quantum Elite — Risk ==="
input double InpRiskPct          = 1.0;
input double InpMinRR            = 1.8;
input int    InpMaxSpreadPts     = 35;      // Max spread (points) — gold ECN ~25-40
input int    InpMagic            = 20260801;
input bool   InpUseTrailing      = true;
input int    InpTrailPts         = 150;
input bool   InpUseBreakeven     = true;
input int    InpBETriggerPts     = 120;

input group "=== 5-Layer validation ==="
input int    InpMinScore         = 75;     // Layer 1: AI-style score
input int    InpMinMTFAgree      = 3;      // Layer 2: multi-timeframe
input bool   InpRequireChecklist = true;   // Layer 3: checklist
input int    InpNewsBlockMin     = 45;     // Layer 4: news
input double InpDailyLossLimit   = 3.0;    // Layer 5: daily loss lock %

input group "=== Signals ==="
input double InpRsiBuyMax        = 64.0;
input double InpRsiSellMin       = 36.0;
input bool   InpGoldPreferred    = true;   // Warn if not XAUUSD
input bool   InpOneTradePerBar   = true;
input bool   InpShowDashboard    = true;

CTrade g_trade;
AuraFX_ProState g_pro;
AuraFX_CalendarEvent g_events[];
datetime g_lastBar = 0;
int g_layers_passed = 0;
const string QFX = "AURAFX_QUANTUM";

//+------------------------------------------------------------------+
int OnInit()
  {
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(25);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   if(InpGoldPreferred && AuraFX_DetectAsset(_Symbol) != AURA_ASSET_GOLD)
      Alert("AuraFX Quantum Elite: optimised for XAUUSD. Current: ", _Symbol);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int r) { ObjectsDeleteAll(ChartID(), QFX); }

bool SpreadOk()
  {
   long spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   return (spread <= InpMaxSpreadPts);
  }

int CountValidationLayers(const ENUM_AURA_SIGNAL sig)
  {
   int n = 0;
   if(g_pro.score.total >= InpMinScore) n++;
   if(sig == AURA_SIGNAL_BUY && g_pro.mtf_agrees_buy) n++;
   else if(sig == AURA_SIGNAL_SELL && g_pro.mtf_agrees_sell) n++;
   else if(sig == AURA_SIGNAL_NONE) { /* skip */ }
   if(!InpRequireChecklist || g_pro.checklist.all_pass) n++;
   if(!g_pro.news_block_entry) n++;
   if(SpreadOk()) n++;
   if(!g_pro.trading_locked) n++;
   return n;
  }

bool QuantumAllowsTrade(const ENUM_AURA_SIGNAL sig)
  {
   if(sig == AURA_SIGNAL_NONE || sig == AURA_SIGNAL_COVER) return false;
   if(g_pro.trading_locked) return false;
   if(g_pro.news_block_entry) return false;
   if(!SpreadOk()) return false;
   if(g_pro.score.total < InpMinScore) return false;
   if(InpRequireChecklist && !g_pro.checklist.all_pass) return false;
   if(g_pro.rr_ratio < InpMinRR) return false;
   if(sig == AURA_SIGNAL_BUY && !g_pro.mtf_agrees_buy) return false;
   if(sig == AURA_SIGNAL_SELL && !g_pro.mtf_agrees_sell) return false;
   g_layers_passed = CountValidationLayers(sig);
   return (g_layers_passed >= 5);
  }

void ManagePositions()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;

      double op = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      bool isBuy = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY;
      double px = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double profitPts = isBuy ? (px - op) / _Point : (op - px) / _Point;

      if(InpUseBreakeven && profitPts >= InpBETriggerPts)
        {
         double be = isBuy ? op + 12 * _Point : op - 12 * _Point;
         if(isBuy && sl < be) g_trade.PositionModify(t, be, tp);
         if(!isBuy && (sl == 0 || sl > be)) g_trade.PositionModify(t, be, tp);
        }
      if(InpUseTrailing && profitPts >= InpTrailPts)
        {
         double nsl = isBuy ? px - InpTrailPts * _Point : px + InpTrailPts * _Point;
         if(isBuy && nsl > sl) g_trade.PositionModify(t, nsl, tp);
         if(!isBuy && (sl == 0 || nsl < sl)) g_trade.PositionModify(t, nsl, tp);
        }
     }
  }

void OnTick()
  {
   datetime bar = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(bar == 0) return;
   bool newBar = (bar != g_lastBar);
   if(newBar) g_lastBar = bar;

   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1,
                                               InpRsiBuyMax, InpRsiSellMin, 0.32);

   AuraFX_CheckLossLimits(InpDailyLossLimit, 6.0, 10.0,
                          g_pro.daily_pnl_pct, g_pro.weekly_pnl_pct,
                          g_pro.trading_locked, g_pro.lock_reason);
   AuraFX_ComputeProScore(_Symbol, sig, g_pro, InpNewsBlockMin, InpMinRR);

   if(InpShowDashboard)
     {
      AuraFX_DrawProDashboard(ChartID(), QFX, 16, 200, g_pro, _Symbol, sig);
      string lbl = QFX + "_layers";
      if(ObjectFind(ChartID(), lbl) < 0)
        {
         ObjectCreate(ChartID(), lbl, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(ChartID(), lbl, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetString(ChartID(), lbl, OBJPROP_FONT, "Segoe UI");
         ObjectSetInteger(ChartID(), lbl, OBJPROP_FONTSIZE, 9);
         ObjectSetInteger(ChartID(), lbl, OBJPROP_COLOR, C'212,175,55');
        }
      ObjectSetInteger(ChartID(), lbl, OBJPROP_XDISTANCE, 30);
      ObjectSetInteger(ChartID(), lbl, OBJPROP_YDISTANCE, 380);
      int layers = CountValidationLayers(sig);
      string spreadTxt = SpreadOk() ? "OK" : "HIGH";
      ObjectSetString(ChartID(), lbl, OBJPROP_TEXT,
         StringFormat("Quantum layers: %d/5 · Spread: %s · No grid/martingale", layers, spreadTxt));
     }

   ManagePositions();

   if(sig == AURA_SIGNAL_COVER)
     {
      CloseAll();
      return;
     }

   if(!newBar && InpOneTradePerBar) return;
   if(!QuantumAllowsTrade(sig)) return;

   ENUM_ORDER_TYPE type = (sig == AURA_SIGNAL_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   double price = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                           : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double lots = AuraFX_CalcRiskLot(_Symbol, InpRiskPct, price, g_pro.suggested_sl,
                                    AccountInfoDouble(ACCOUNT_BALANCE));
   if(lots <= 0) lots = 0.01;

   if(CountPos(type) == 0)
     {
      CloseOpposite(type);
      g_trade.PositionOpen(_Symbol, type, lots, price, g_pro.suggested_sl, g_pro.suggested_tp,
                             "AuraFX Quantum Elite");
     }
  }

int CountPos(const ENUM_ORDER_TYPE t)
  {
   ENUM_POSITION_TYPE pt = (t == ORDER_TYPE_BUY) ? POSITION_TYPE_BUY : POSITION_TYPE_SELL;
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!PositionSelectByTicket(PositionGetTicket(i))) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == pt) n++;
     }
   return n;
  }

void CloseOpposite(const ENUM_ORDER_TYPE t)
  {
   ENUM_POSITION_TYPE c = (t == ORDER_TYPE_BUY) ? POSITION_TYPE_SELL : POSITION_TYPE_BUY;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(!PositionSelectByTicket(tk)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == c)
         g_trade.PositionClose(tk);
     }
  }

void CloseAll()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(!PositionSelectByTicket(tk)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      g_trade.PositionClose(tk);
     }
  }
