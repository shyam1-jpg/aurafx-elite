//+------------------------------------------------------------------+
//| AuraFX_TestOneOrder_EA.mq5 — places ONE demo buy to verify setup   |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property version   "1.00"
#property description "Demo test: one 0.01 BUY on chart symbol when attached."

#include <Trade\Trade.mqh>

input double InpLots      = 0.01;
input int    InpMagic     = 20260830;
input int    InpSlPoints  = 250;
input int    InpTpPoints  = 500;

CTrade g_trade;
bool g_placed = false;

int MinStops(const string sym)
  {
   int lvl = (int)SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL);
   int sp  = (int)SymbolInfoInteger(sym, SYMBOL_SPREAD);
   return MathMax(lvl + sp + 10, 30);
  }

bool PlaceTestBuy()
  {
   string sym = _Symbol;
   if(!SymbolSelect(sym, true)) return false;
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   if(ask <= 0) return false;

   double pt  = SymbolInfoDouble(sym, SYMBOL_POINT);
   int dig    = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   int slPts  = MathMax(InpSlPoints, MinStops(sym));
   int tpPts  = MathMax(InpTpPoints, slPts * 2);
   double sl  = NormalizeDouble(ask - slPts * pt, dig);
   double tp  = NormalizeDouble(ask + tpPts * pt, dig);

   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(80);
   g_trade.SetTypeFillingBySymbol(sym);

   if(g_trade.Buy(InpLots, sym, ask, sl, tp, "AuraFX test order"))
     {
      Print("AuraFX test BUY OK ", sym, " @ ", ask, " SL=", sl, " TP=", tp);
      return true;
     }
   Print("AuraFX test BUY FAIL err=", GetLastError());
   return false;
  }

int OnInit()
  {
   if(g_placed) return INIT_SUCCEEDED;

   if(AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO)
     {
      Alert("AuraFX Test Order: DEMO account only.");
      return INIT_SUCCEEDED;
     }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
     {
      Alert("AuraFX Test Order: Click Algo Trading GREEN, then remove and re-attach EA.");
      return INIT_SUCCEEDED;
     }

   if(PlaceTestBuy())
     {
      g_placed = true;
      Alert(StringFormat("AuraFX: test BUY placed on %s — check Trade tab.", _Symbol));
     }
   else
      Alert("AuraFX: test order failed — see Experts log (Algo ON? market open?).");

   return INIT_SUCCEEDED;
  }

void OnTick() {}
