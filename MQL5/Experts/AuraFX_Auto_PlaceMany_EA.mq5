//+------------------------------------------------------------------+
//| AuraFX_Auto_PlaceMany_EA.mq5 — places many demo orders on start  |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property version   "1.00"
#property description "Auto-places demo orders on attach. Demo + Algo ON required."

#include <Trade\Trade.mqh>

input double InpLots      = 0.01;
input int    InpSlPoints  = 150;
input int    InpTpPoints  = 300;
input int    InpMagic     = 20260624;
input bool   InpBuyAndSell = true;

CTrade g_trade;
bool g_done = false;

string g_forex[]  = {"EURUSD","GBPUSD","USDJPY","AUDUSD","USDCHF","NZDUSD"};
string g_gold[]   = {"XAUUSD","XAUAUD"};
string g_silver[] = {"XAGUSD"};
string g_index[]  = {"US30","US500","NAS100","USTEC","GER40","UK100"};

bool Ensure(const string s)
  {
   return SymbolSelect(s, true) && SymbolInfoDouble(s, SYMBOL_BID) > 0;
  }

int MinStops(const string s)
  {
   int lvl = (int)SymbolInfoInteger(s, SYMBOL_TRADE_STOPS_LEVEL);
   int sp = (int)SymbolInfoInteger(s, SYMBOL_SPREAD);
   return MathMax(lvl + sp + 5, 25);
  }

bool Place(const string sym, const ENUM_ORDER_TYPE type, int &n)
  {
   double pt = SymbolInfoDouble(sym, SYMBOL_POINT);
   int dig = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   int slP = MathMax(InpSlPoints, MinStops(sym));
   int tpP = MathMax(InpTpPoints, slP * 2);
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(80);
   g_trade.SetTypeFillingBySymbol(sym);

   if(type == ORDER_TYPE_BUY)
     {
      double a = SymbolInfoDouble(sym, SYMBOL_ASK);
      if(g_trade.Buy(InpLots, sym, a, a - slP*pt, a + tpP*pt, "AuraFX Auto Buy"))
        { n++; return true; }
     }
   else
     {
      double b = SymbolInfoDouble(sym, SYMBOL_BID);
      if(g_trade.Sell(InpLots, sym, b, b + slP*pt, b - tpP*pt, "AuraFX Auto Sell"))
        { n++; return true; }
     }
   return false;
  }

void TryList(const string &arr[], const int cnt, int &n)
  {
   for(int i = 0; i < cnt; i++)
     {
      if(!Ensure(arr[i])) continue;
      Place(arr[i], ORDER_TYPE_BUY, n);
      Sleep(400);
      if(InpBuyAndSell) Place(arr[i], ORDER_TYPE_SELL, n);
      Sleep(400);
      return;
     }
  }

int OnInit()
  {
   if(g_done) return INIT_SUCCEEDED;

   if(AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO)
     {
      Alert("AuraFX Auto Place: DEMO account only.");
      return INIT_SUCCEEDED;
     }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
     {
      Alert("AuraFX Auto Place: Turn Algo Trading GREEN then remove and re-attach this EA.");
      return INIT_SUCCEEDED;
     }

   int n = 0;
   TryList(g_forex,  ArraySize(g_forex),  n);
   TryList(g_gold,   ArraySize(g_gold),   n);
   TryList(g_silver, ArraySize(g_silver), n);
   TryList(g_index,  ArraySize(g_index),  n);
   if(Ensure(_Symbol))
     {
      Place(_Symbol, ORDER_TYPE_BUY, n);
      if(InpBuyAndSell) Place(_Symbol, ORDER_TYPE_SELL, n);
     }

   g_done = true;
   Alert(StringFormat("AuraFX Auto Place: %d orders placed. Check Terminal - Trade tab.", n));
   Print("AuraFX Auto Place total: ", n);
   return INIT_SUCCEEDED;
  }

void OnTick() {}
