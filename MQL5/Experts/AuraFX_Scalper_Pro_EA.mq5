//+------------------------------------------------------------------+
//| AuraFX_Scalper_Pro_EA.mq5 — fast M5/M15 scalper style            |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Scalper Pro style — fast EMA + RSI on M5/M15. Demo test first."

#include <Trade\Trade.mqh>

input double InpLots = 0.01;
input int    InpFast = 5;
input int    InpSlow = 13;
input int    InpSl = 80;
input int    InpTp = 160;
input int    InpMagic = 20260702;
input bool   InpTrail = true;
input int    InpTrailPts = 60;

CTrade g_trade;
int hF, hS, hR;
datetime g_bar = 0;

int OnInit()
  {
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   hF = iMA(_Symbol, PERIOD_CURRENT, InpFast, 0, MODE_EMA, PRICE_CLOSE);
   hS = iMA(_Symbol, PERIOD_CURRENT, InpSlow, 0, MODE_EMA, PRICE_CLOSE);
   hR = iRSI(_Symbol, PERIOD_CURRENT, 7, PRICE_CLOSE);
   return (hF > 0 && hS > 0 && hR > 0) ? INIT_SUCCEEDED : INIT_FAILED;
  }

double Buf(int h, int sh) { double v[]; if(CopyBuffer(h,0,sh,1,v)!=1) return 0; return v[0]; }

void OnTick()
  {
   datetime b = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(b == g_bar) { if(InpTrail) Trail(); return; }
   g_bar = b;

   double f0 = Buf(hF,1), s0 = Buf(hS,1), f1 = Buf(hF,2), s1 = Buf(hS,2), rsi = Buf(hR,1);
   bool up = f0 > s0 && f1 <= s1 && rsi < 68;
   bool dn = f0 < s0 && f1 >= s1 && rsi > 32;

   if(up) Buy();
   if(dn) Sell();
   if(InpTrail) Trail();
  }

void Buy()
  {
   double a = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   g_trade.Buy(InpLots, _Symbol, a, a - InpSl*_Point, a + InpTp*_Point, "AuraFX Scalper Buy");
  }

void Sell()
  {
   double b = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   g_trade.Sell(InpLots, _Symbol, b, b + InpSl*_Point, b - InpTp*_Point, "AuraFX Scalper Sell");
  }

void Trail()
  {
   for(int i = PositionsTotal()-1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t) || PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      double sl = PositionGetDouble(POSITION_SL), tp = PositionGetDouble(POSITION_TP);
      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
        {
         double n = SymbolInfoDouble(_Symbol, SYMBOL_BID) - InpTrailPts*_Point;
         if(n > sl) g_trade.PositionModify(t, n, tp);
        }
      else
        {
         double n = SymbolInfoDouble(_Symbol, SYMBOL_ASK) + InpTrailPts*_Point;
         if(sl == 0 || n < sl) g_trade.PositionModify(t, n, tp);
        }
     }
  }
