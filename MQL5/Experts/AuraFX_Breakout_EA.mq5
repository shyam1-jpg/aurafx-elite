//+------------------------------------------------------------------+
//| AuraFX_Breakout_EA.mq5 — BOS / structure breakout system         |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Ultimate breakout style — BOS, FVG, structure bias. Educational only."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_Structure.mqh>

input double InpLots = 0.01;
input int    InpSl = 250;
input int    InpTp = 500;
input int    InpMagic = 20260703;
input bool   InpBosOnly = true;     // Trade BOS without waiting for extra signal
input bool   InpShowPanel = true;

CTrade trade;
AuraFX_Stats stats;
datetime g_bar = 0;

int OnInit()
  {
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetTypeFillingBySymbol(_Symbol);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int r) { AuraFX_DeletePanel(ChartID(), "AURAFX_BO"); }

void OnTick()
  {
   datetime b = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(b == g_bar) return;
   g_bar = b;

   AuraFX_StructureState st;
   AuraFX_AnalyzeStructure(_Symbol, PERIOD_CURRENT, st);
   ENUM_AURA_ASSET asset = AuraFX_DetectAsset(_Symbol);
   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1, 62, 38, 0.35);

   if(InpShowPanel)
      AuraFX_DrawPanel(ChartID(), "AURAFX_BO", 16, 28, sig, stats, _Symbol, asset);

   if(InpBosOnly)
     {
      if(st.bos_up) Open(ORDER_TYPE_BUY);
      else if(st.bos_down) Open(ORDER_TYPE_SELL);
      return;
     }

   if(st.bos_up && sig == AURA_SIGNAL_BUY)
      Open(ORDER_TYPE_BUY);
   else if(st.bos_down && sig == AURA_SIGNAL_SELL)
      Open(ORDER_TYPE_SELL);
  }

void Open(const ENUM_ORDER_TYPE type)
  {
   for(int i = PositionsTotal()-1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(PositionSelectByTicket(t) && PositionGetInteger(POSITION_MAGIC) == InpMagic)
         trade.PositionClose(t);
     }
   double px = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = (type == ORDER_TYPE_BUY) ? px - InpSl*_Point : px + InpSl*_Point;
   double tp = (type == ORDER_TYPE_BUY) ? px + InpTp*_Point : px - InpTp*_Point;
   trade.PositionOpen(_Symbol, type, InpLots, px, sl, tp, "AuraFX Breakout");
  }
