//+------------------------------------------------------------------+
//| AuraFX_M1_Hyper_Scalper_EA.mq5 — fastest demo scalper            |
//| M1 chart · many trades · shows if Algo/smiley is blocking you   |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "M1 hyper scalper — attach to M1 only. Needs green Algo + smiley face."

#include <Trade\Trade.mqh>

input double InpLots        = 0.02;
input int    InpSlPoints    = 80;
input int    InpTpPoints    = 120;
input int    InpFastEma     = 3;
input int    InpSlowEma     = 8;
input int    InpMagic       = 20260825;
input bool   InpCloseReverse = true;   // Close opposite then open (more turnover)
input bool   InpShowStatus  = true;

CTrade g_trade;
int g_hFast, g_hSlow, g_hRsi;
datetime g_bar = 0;
int g_tradesToday = 0;

//+------------------------------------------------------------------+
int OnInit()
  {
   if(Period() != PERIOD_M1)
      Alert("AuraFX Hyper Scalper: use M1 chart for fast scalping!");

   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(40);
   g_trade.SetTypeFillingBySymbol(_Symbol);

   g_hFast = iMA(_Symbol, PERIOD_M1, InpFastEma, 0, MODE_EMA, PRICE_CLOSE);
   g_hSlow = iMA(_Symbol, PERIOD_M1, InpSlowEma, 0, MODE_EMA, PRICE_CLOSE);
   g_hRsi  = iRSI(_Symbol, PERIOD_M1, 7, PRICE_CLOSE);
   if(g_hFast <= 0 || g_hSlow <= 0 || g_hRsi <= 0)
      return INIT_FAILED;

   ShowStatus("Starting...");
   if(!IsAlgoLive())
      Alert("AuraFX: ALGO BLOCKED! Top toolbar → Algo Trading button GREEN. Chart needs smiley face ☺");

   return INIT_SUCCEEDED;
  }

void OnDeinit(const int r) { Comment(""); }

bool IsAlgoLive()
  {
   return TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) &&
          MQLInfoInteger(MQL_TRADE_ALLOWED) &&
          AccountInfoInteger(ACCOUNT_TRADE_EXPERT);
  }

void ShowStatus(const string extra)
  {
   if(!InpShowStatus) return;
   string algo = IsAlgoLive() ? "ALGO ON ☺ — scalping active" : "ALGO OFF ✗ — NO TRADES until green button + smiley!";
   string acct = (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO) ? "DEMO" : "LIVE";
   Comment(StringFormat("AuraFX M1 HYPER SCALPER | %s | %s\n%s\nTrades this session: %d | %s",
                        _Symbol, acct, algo, g_tradesToday, extra));
  }

double Buf(const int h, const int sh)
  {
   double v[];
   if(CopyBuffer(h, 0, sh, 1, v) != 1) return 0;
   return v[0];
  }

void CloseMine()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      g_trade.PositionClose(t);
     }
  }

bool Open(const ENUM_ORDER_TYPE type)
  {
   double px = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                        : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = (type == ORDER_TYPE_BUY) ? px - InpSlPoints * _Point : px + InpSlPoints * _Point;
   double tp = (type == ORDER_TYPE_BUY) ? px + InpTpPoints * _Point : px - InpTpPoints * _Point;
   bool ok = g_trade.PositionOpen(_Symbol, type, InpLots, px, sl, tp, "AuraFX M1 Hyper");
   if(ok) g_tradesToday++;
   return ok;
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   if(!IsAlgoLive())
     {
      ShowStatus("Fix: Tools→Options→Expert Advisors→Allow algo trading. Click Algo button GREEN.");
      return;
     }

   datetime b = iTime(_Symbol, PERIOD_M1, 0);
   if(b == g_bar) return;
   g_bar = b;

   double f0 = Buf(g_hFast, 1), f1 = Buf(g_hFast, 2);
   double s0 = Buf(g_hSlow, 1), s1 = Buf(g_hSlow, 2);
   double rsi = Buf(g_hRsi, 1);

   bool buy  = (f0 > s0 && f1 <= s1) || rsi < 38;
   bool sell = (f0 < s0 && f1 >= s1) || rsi > 62;

   if(!buy && !sell)
     {
      ShowStatus("Scanning M1...");
      return;
     }

   if(InpCloseReverse) CloseMine();

   if(buy) Open(ORDER_TYPE_BUY);
   else if(sell) Open(ORDER_TYPE_SELL);

   ShowStatus(buy ? "BUY opened" : "SELL opened");
  }
