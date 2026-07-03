//+------------------------------------------------------------------+
//| AuraFX_Gold_Reaper_EA.mq5 — XAUUSD gold specialist (demo first)  |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Gold Reaper style EA for XAUUSD — structure + elite signals. Educational only."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_Structure.mqh>
#include <AuraFX_NewsRisk.mqh>

input double InpLots = 0.01;
input bool   InpAutoLots = true;
input double InpRiskPct = 1.0;
input int    InpSlPoints = 350;
input int    InpTpPoints = 700;
input int    InpMagic = 20260701;
input bool   InpUseTrailing = true;
input int    InpTrailPts = 200;
input bool   InpBlockNews = true;
input bool   InpShowPanel = true;

CTrade trade;
AuraFX_Stats g_stats;
datetime g_lastBar = 0;

int OnInit()
  {
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetTypeFillingBySymbol(_Symbol);
   if(AuraFX_DetectAsset(_Symbol) != AURA_ASSET_GOLD)
      Alert("AuraFX Gold Reaper: best on XAUUSD. Current: ", _Symbol);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason) { AuraFX_DeletePanel(ChartID(), "AURAFX_GR"); }

double CalcLots()
  {
   if(!InpAutoLots) return InpLots;
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double tv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tv <= 0 || ts <= 0) return InpLots;
   double risk = bal * InpRiskPct / 100.0;
   double lots = risk / (InpSlPoints * _Point / ts * tv);
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   lots = MathFloor(lots / step) * step;
   return MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), lots);
  }

void Open(const ENUM_ORDER_TYPE type)
  {
   double px = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = (type == ORDER_TYPE_BUY) ? px - InpSlPoints * _Point : px + InpSlPoints * _Point;
   double tp = (type == ORDER_TYPE_BUY) ? px + InpTpPoints * _Point : px - InpTpPoints * _Point;
   trade.PositionOpen(_Symbol, type, CalcLots(), px, sl, tp, "AuraFX Gold Reaper");
  }

void OnTick()
  {
   datetime bar = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(bar == g_lastBar) return;
   g_lastBar = bar;

   AuraFX_StructureState st;
   AuraFX_AnalyzeStructure(_Symbol, PERIOD_CURRENT, st);
   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1, 65, 35, 0.3);

   if(InpShowPanel)
      AuraFX_DrawPanel(ChartID(), "AURAFX_GR", 16, 28, sig, g_stats, _Symbol, AURA_ASSET_GOLD);

   if(InpBlockNews)
     {
      AuraFX_CalendarEvent ev[];
      AuraFX_CalendarEvent next;
      AuraFX_LoadCalendarEvents(ev, 60, 24, "USD");
      if(AuraFX_FindNextHighImpact(ev, next, 60) && next.risk >= AURA_RISK_HIGH) return;
     }

   if(sig == AURA_SIGNAL_BUY && (st.bias >= 0 || st.bullish_ob || st.bos_up))
      Open(ORDER_TYPE_BUY);
   else if(sig == AURA_SIGNAL_SELL && (st.bias <= 0 || st.bearish_ob || st.bos_down))
      Open(ORDER_TYPE_SELL);

   if(InpUseTrailing)
     {
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         ulong t = PositionGetTicket(i);
         if(!PositionSelectByTicket(t)) continue;
         if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
         double sl = PositionGetDouble(POSITION_SL);
         double tp = PositionGetDouble(POSITION_TP);
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
           {
            double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
            double nsl = bid - InpTrailPts * _Point;
            if(nsl > sl) trade.PositionModify(t, nsl, tp);
           }
        }
     }
  }
