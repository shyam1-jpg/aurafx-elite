//+------------------------------------------------------------------+
//| AuraFX_Pulse_Engine_EA.mq5 — MACD pulse momentum engine        |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Pulse Engine style — MACD histogram momentum with RSI filter."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>

input double InpLots = 0.01;
input int    InpSl = 180;
input int    InpTp = 360;
input int    InpMagic = 20260704;
input bool   InpShowPanel = true;

CTrade trade;
AuraFX_Stats stats;
int hMacd;
datetime g_bar = 0;

int OnInit()
  {
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetTypeFillingBySymbol(_Symbol);
   hMacd = iMACD(_Symbol, PERIOD_CURRENT, 12, 26, 9, PRICE_CLOSE);
   return hMacd > 0 ? INIT_SUCCEEDED : INIT_FAILED;
  }

void OnDeinit(const int r) { AuraFX_DeletePanel(ChartID(), "AURAFX_PE"); IndicatorRelease(hMacd); }

void OnTick()
  {
   datetime b = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(b == g_bar) return;
   g_bar = b;

   double m0[], m1[], s0[];
   ArraySetAsSeries(m0,true); ArraySetAsSeries(m1,true); ArraySetAsSeries(s0,true);
   if(CopyBuffer(hMacd,0,1,2,m0)<2 || CopyBuffer(hMacd,1,1,1,s0)<1) return;
   CopyBuffer(hMacd,0,2,1,m1);

   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1, 62, 38, 0.35);
   if(InpShowPanel)
      AuraFX_DrawPanel(ChartID(), "AURAFX_PE", 16, 28, sig, stats, _Symbol, AuraFX_DetectAsset(_Symbol));

   bool pulseUp = m0[0] > s0[0] && m1[0] <= s0[0];
   bool pulseDn = m0[0] < s0[0] && m1[0] >= s0[0];

   if(pulseUp && sig == AURA_SIGNAL_BUY) Open(ORDER_TYPE_BUY);
   if(pulseDn && sig == AURA_SIGNAL_SELL) Open(ORDER_TYPE_SELL);
  }

void Open(const ENUM_ORDER_TYPE type)
  {
   double px = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = (type == ORDER_TYPE_BUY) ? px - InpSl*_Point : px + InpSl*_Point;
   double tp = (type == ORDER_TYPE_BUY) ? px + InpTp*_Point : px - InpTp*_Point;
   trade.PositionOpen(_Symbol, type, InpLots, px, sl, tp, "AuraFX Pulse");
  }
