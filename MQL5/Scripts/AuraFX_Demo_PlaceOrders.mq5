//+------------------------------------------------------------------+
//| AuraFX_Demo_PlaceOrders.mq5                                      |
//| DEMO ONLY — places 3 small test orders so you can see how it works |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property version   "1.00"
#property description "Demo script: places sample BUY/SELL orders with SL and TP. Demo account only."
#property script_show_inputs

#include <Trade\Trade.mqh>

input double InpLots        = 0.01;
input int    InpSlPoints    = 120;
input int    InpTpPoints    = 240;
input int    InpMagic       = 20260623;
input int    InpOrderCount  = 3;   // 1=BUY only, 2=BUY+SELL, 3=BUY+BUY+SELL

CTrade trade;

bool PlaceBuy(const string comment)
  {
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double sl = ask - InpSlPoints * _Point;
   double tp = ask + InpTpPoints * _Point;
   return trade.Buy(InpLots, _Symbol, ask, sl, tp, comment);
  }

bool PlaceSell(const string comment)
  {
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = bid + InpSlPoints * _Point;
   double tp = bid - InpTpPoints * _Point;
   return trade.Sell(InpLots, _Symbol, bid, sl, tp, comment);
  }

//+------------------------------------------------------------------+
void OnStart()
  {
   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
     {
      Alert("AuraFX Demo: trading not allowed on this account.");
      return;
     }

   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(30);
   trade.SetTypeFillingBySymbol(_Symbol);

   int placed = 0;
   string sym = _Symbol;

   if(PlaceBuy("AuraFX Demo Buy #1"))
      placed++;
   Sleep(800);

   if(InpOrderCount >= 2)
     {
      if(PlaceSell("AuraFX Demo Sell #1"))
         placed++;
      Sleep(800);
     }

   if(InpOrderCount >= 3)
     {
      if(PlaceBuy("AuraFX Demo Buy #2"))
         placed++;
     }

   string msg = StringFormat(
      "AuraFX Demo: placed %d order(s) on %s.\nLot=%.2f SL=%d pts TP=%d pts\nOpen Terminal - Trade tab to view.",
      placed, sym, InpLots, InpSlPoints, InpTpPoints);
   Alert(msg);
   Print(msg);
  }
//+------------------------------------------------------------------+
