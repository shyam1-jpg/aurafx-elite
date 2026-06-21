//+------------------------------------------------------------------+
//| AuraFX_Pro_EA.mq5 — Elite signals + full Pro filters             |
//+------------------------------------------------------------------+
#property copyright "AuraFX Labs"
#property version   "2.00"
#property description "AuraFX Pro EA: MTF, scoring, R:R, news block, loss limits."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_NewsRisk.mqh>
#include <AuraFX_Pro.mqh>

input group "=== Pro Risk ==="
input double InpRiskPct         = 1.0;
input double InpMinRR           = 2.0;
input double InpDailyLossLimit  = 3.0;
input double InpWeeklyLossLimit = 6.0;
input double InpMaxDrawdownLock = 10.0;
input int    InpNewsBlockMin    = 30;
input int    InpMinScore        = 80;
input int    InpMinMTFAgree     = 4;
input bool   InpRequireChecklist = true;
input int    InpMagic           = 202606;

input group "=== Signals ==="
input double InpRsiBuyMax       = 62.0;
input double InpRsiSellMin      = 38.0;
input double InpAtrMultMin      = 0.35;
input bool   InpAllowCover      = true;
input bool   InpOneTradePerBar  = true;
input bool   InpShowProPanel    = true;

CTrade trade;
AuraFX_ProState g_pro;
datetime g_lastBar = 0;
const string PRO_PREFIX = "AURAFX_PROEA";

//+------------------------------------------------------------------+
int OnInit()
  {
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(20);
   trade.SetTypeFillingBySymbol(_Symbol);
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(ChartID(), PRO_PREFIX);
  }

//+------------------------------------------------------------------+
bool ProAllowsTrade(const ENUM_AURA_SIGNAL sig)
  {
   if(sig == AURA_SIGNAL_NONE) return false;
   if(g_pro.trading_locked) return false;
   if(g_pro.news_block_entry) return false;
   if(g_pro.score.total < InpMinScore) return false;
   if(InpRequireChecklist && !g_pro.checklist.all_pass) return false;
   if(g_pro.rr_ratio < InpMinRR) return false;
   if(sig == AURA_SIGNAL_BUY && !g_pro.mtf_agrees_buy) return false;
   if(sig == AURA_SIGNAL_SELL && !g_pro.mtf_agrees_sell) return false;
   if(AuraFX_CorrelationWarning(_Symbol, sig == AURA_SIGNAL_BUY ? 1 : -1) > 0)
     {
      Comment("Correlation warning: trade conflicts with USD/Gold bias. ", AURA_PRO_DISCLAIMER);
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   datetime bar = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(bar == 0) return;
   bool newBar = (bar != g_lastBar);
   if(newBar) g_lastBar = bar;

   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1,
                                               InpRsiBuyMax, InpRsiSellMin, InpAtrMultMin);

   AuraFX_CheckLossLimits(InpDailyLossLimit, InpWeeklyLossLimit, InpMaxDrawdownLock,
                          g_pro.daily_pnl_pct, g_pro.weekly_pnl_pct,
                          g_pro.trading_locked, g_pro.lock_reason);
   AuraFX_ComputeProScore(_Symbol, sig, g_pro, InpNewsBlockMin, InpMinRR);

   if(InpShowProPanel)
      AuraFX_DrawProDashboard(ChartID(), PRO_PREFIX, 16, 180, g_pro, _Symbol, sig);

   if(g_pro.crash_alert)
      AuraFX_SendRiskAlert("PRO EA CRASH ALERT", "Consider protecting open positions.", true);

   if(sig == AURA_SIGNAL_COVER && InpAllowCover)
     {
      CloseAll();
      return;
     }

   if(!newBar && InpOneTradePerBar) return;
   if(!ProAllowsTrade(sig)) return;

   ENUM_ORDER_TYPE type = (sig == AURA_SIGNAL_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   double price = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                           : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double lots = AuraFX_CalcRiskLot(_Symbol, InpRiskPct, price, g_pro.suggested_sl,
                                    AccountInfoDouble(ACCOUNT_BALANCE));
   if(lots <= 0) lots = 0.01;

   if(CountPos(type) == 0)
     {
      CloseOpposite(type);
      trade.PositionOpen(_Symbol, type, lots, price, g_pro.suggested_sl, g_pro.suggested_tp, "AuraFX Pro");
     }
  }

//+------------------------------------------------------------------+
int CountPos(const ENUM_ORDER_TYPE t)
  {
   int n = 0;
   ENUM_POSITION_TYPE pt = (t == ORDER_TYPE_BUY) ? POSITION_TYPE_BUY : POSITION_TYPE_SELL;
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
   ENUM_POSITION_TYPE close = (t == ORDER_TYPE_BUY) ? POSITION_TYPE_SELL : POSITION_TYPE_BUY;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong tk = PositionGetTicket(i);
      if(!PositionSelectByTicket(tk)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == close)
         trade.PositionClose(tk);
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
      trade.PositionClose(tk);
     }
  }

//+------------------------------------------------------------------+
