//+------------------------------------------------------------------+
//| AuraFX_PlaceMany_DemoOrders.mq5                                  |
//| Places demo orders on forex, gold, silver, indices at once       |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property version   "1.00"
#property description "Demo: many orders across markets. Drag onto any chart."
#property script_show_inputs

#include <Trade\Trade.mqh>

input double InpLots         = 0.01;
input int    InpSlPoints     = 150;
input int    InpTpPoints     = 300;
input int    InpMagic        = 20260624;
input bool   InpPlaceBuy     = true;
input bool   InpPlaceSell    = true;   // Also one SELL per symbol (more orders)
input int    InpPauseMs      = 600;    // Delay between orders (ms)

CTrade g_trade;

// Broker symbol names vary — script tries each group until one works
string g_forex[]  = {"EURUSD","GBPUSD","USDJPY","AUDUSD","USDCHF","NZDUSD","USDCAD"};
string g_gold[]   = {"XAUUSD","GOLD","XAUAUD"};
string g_silver[] = {"XAGUSD","SILVER"};
string g_index[]  = {"US30","US500","NAS100","USTEC","GER40","DE40","UK100","US100","SPX500"};

//+------------------------------------------------------------------+
bool EnsureSymbol(const string sym)
  {
   if(!SymbolSelect(sym, true)) return false;
   if(SymbolInfoDouble(sym, SYMBOL_BID) <= 0) return false;
   return true;
  }

int MinStopPts(const string sym)
  {
   int lvl = (int)SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL);
   int spread = (int)SymbolInfoInteger(sym, SYMBOL_SPREAD);
   return MathMax(lvl + spread + 5, 20);
  }

bool OpenBuy(const string sym, const string tag, int &placed)
  {
   double pt = SymbolInfoDouble(sym, SYMBOL_POINT);
   int dig = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   int minSt = MinStopPts(sym);
   int slPts = MathMax(InpSlPoints, minSt);
   int tpPts = MathMax(InpTpPoints, minSt * 2);

   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   if(ask <= 0) return false;

   double sl = NormalizeDouble(ask - slPts * pt, dig);
   double tp = NormalizeDouble(ask + tpPts * pt, dig);

   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(50);
   g_trade.SetTypeFillingBySymbol(sym);

   if(g_trade.Buy(InpLots, sym, ask, sl, tp, tag))
     {
      placed++;
      Print("OK BUY ", sym, " @ ", ask);
      return true;
     }
   Print("FAIL BUY ", sym, " err=", GetLastError());
   return false;
  }

bool OpenSell(const string sym, const string tag, int &placed)
  {
   double pt = SymbolInfoDouble(sym, SYMBOL_POINT);
   int dig = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   int minSt = MinStopPts(sym);
   int slPts = MathMax(InpSlPoints, minSt);
   int tpPts = MathMax(InpTpPoints, minSt * 2);

   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   if(bid <= 0) return false;

   double sl = NormalizeDouble(bid + slPts * pt, dig);
   double tp = NormalizeDouble(bid - tpPts * pt, dig);

   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(50);
   g_trade.SetTypeFillingBySymbol(sym);

   if(g_trade.Sell(InpLots, sym, bid, sl, tp, tag))
     {
      placed++;
      Print("OK SELL ", sym, " @ ", bid);
      return true;
     }
   Print("FAIL SELL ", sym, " err=", GetLastError());
   return false;
  }

bool TryGroup(const string &names[], const int count, const string label, int &placed)
  {
   for(int i = 0; i < count; i++)
     {
      if(!EnsureSymbol(names[i])) continue;
      if(InpPlaceBuy)
        {
         OpenBuy(names[i], "AuraFX " + label + " Buy", placed);
         Sleep(InpPauseMs);
        }
      if(InpPlaceSell)
        {
         OpenSell(names[i], "AuraFX " + label + " Sell", placed);
         Sleep(InpPauseMs);
        }
      return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
void OnStart()
  {
   if(AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO)
     {
      Alert("AuraFX: use DEMO account only for this script.");
      return;
     }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
     {
      Alert("AuraFX: click Algo Trading GREEN first, then run script again.");
      return;
     }

   int placed = 0;
   int tried = 0;

   TryGroup(g_forex,  ArraySize(g_forex),  "Forex", placed);  tried++;
   TryGroup(g_gold,   ArraySize(g_gold),   "Gold", placed);   tried++;
   TryGroup(g_silver, ArraySize(g_silver), "Silver", placed); tried++;
   TryGroup(g_index,  ArraySize(g_index),  "Index", placed);  tried++;

   // Always try current chart symbol too
   if(EnsureSymbol(_Symbol))
     {
      if(InpPlaceBuy)  OpenBuy(_Symbol,  "AuraFX Chart Buy",  placed);
      Sleep(InpPauseMs);
      if(InpPlaceSell) OpenSell(_Symbol, "AuraFX Chart Sell", placed);
     }

   string msg = StringFormat(
      "AuraFX: placed %d demo order(s).\nForex + Gold + Silver + Index (what your broker has).\nTerminal - Trade tab to view.",
      placed);
   Alert(msg);
   Print(msg);
  }
