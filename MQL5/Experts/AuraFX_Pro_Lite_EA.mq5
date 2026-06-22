//+------------------------------------------------------------------+
//|                                       AuraFX_Pro_Lite_EA.mq5     |
//|                        Copyright 2026, AuraFX Elite              |
//|  Simple EMA+RSI EA with live dashboard. Use demo first.          |
//+------------------------------------------------------------------+
#property copyright "AuraFX Elite"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "AuraFX Pro Lite: EMA crossover + RSI with on-chart dashboard. Educational — not financial advice."

#include <Trade\Trade.mqh>

input group "=== Trade ==="
input double   InpLots           = 0.01;
input int      InpSlippage       = 20;
input int      InpMagicNumber    = 20260622;
input int      InpStopLossPts    = 150;
input int      InpTakeProfitPts  = 300;
input bool     InpUseTrailing    = true;
input int      InpTrailingStopPts = 100;

input group "=== Signals ==="
input int      InpFastMA         = 9;
input int      InpSlowMA         = 21;
input int      InpRSI_Period     = 14;
input double   InpRSI_Overbought = 70.0;
input double   InpRSI_Oversold   = 30.0;

input group "=== Dashboard ==="
input bool     InpShowDashboard  = true;
input int      InpPanelX         = 10;
input int      InpPanelY         = 10;

#define AFX_BG      C'12,14,22'
#define AFX_BORDER  C'212,175,55'
#define AFX_GOLD    C'212,175,55'
#define AFX_BUY     C'46,204,113'
#define AFX_SELL    C'231,76,60'
#define AFX_TEXT    C'230,232,240'
#define AFX_MUTED   C'120,125,145'

const string AFX_PREFIX = "AuraFX_";

CTrade g_trade;
datetime g_lastBarTime = 0;
int g_hFast = INVALID_HANDLE;
int g_hSlow = INVALID_HANDLE;
int g_hRsi  = INVALID_HANDLE;
string g_lastSignalText = "None";

//+------------------------------------------------------------------+
int OnInit()
  {
   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints(InpSlippage);
   g_trade.SetTypeFillingBySymbol(_Symbol);

   g_hFast = iMA(_Symbol, PERIOD_CURRENT, InpFastMA, 0, MODE_EMA, PRICE_CLOSE);
   g_hSlow = iMA(_Symbol, PERIOD_CURRENT, InpSlowMA, 0, MODE_EMA, PRICE_CLOSE);
   g_hRsi  = iRSI(_Symbol, PERIOD_CURRENT, InpRSI_Period, PRICE_CLOSE);

   if(g_hFast == INVALID_HANDLE || g_hSlow == INVALID_HANDLE || g_hRsi == INVALID_HANDLE)
     {
      Print("AuraFX Pro Lite EA: indicator handle error.");
      return INIT_FAILED;
     }

   if(InpShowDashboard)
      CreateDashboard();

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(ChartID(), AFX_PREFIX);
   if(g_hFast != INVALID_HANDLE) IndicatorRelease(g_hFast);
   if(g_hSlow != INVALID_HANDLE) IndicatorRelease(g_hSlow);
   if(g_hRsi  != INVALID_HANDLE) IndicatorRelease(g_hRsi);
   Comment("");
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   if(InpShowDashboard)
      UpdateDashboard();

   if(!IsNewBar())
      return;

   double fast = Buf(g_hFast, 1);
   double slow = Buf(g_hSlow, 1);
   double fastPrev = Buf(g_hFast, 2);
   double slowPrev = Buf(g_hSlow, 2);
   double rsi = Buf(g_hRsi, 1);

   if(fast == EMPTY_VALUE || slow == EMPTY_VALUE || rsi == EMPTY_VALUE)
      return;

   if(HasPosition(POSITION_TYPE_BUY) && fast < slow)
      CloseByType(POSITION_TYPE_BUY);

   if(HasPosition(POSITION_TYPE_SELL) && fast > slow)
      CloseByType(POSITION_TYPE_SELL);

   bool crossUp   = fast > slow && fastPrev <= slowPrev;
   bool crossDown = fast < slow && fastPrev >= slowPrev;

   if(crossUp && rsi < InpRSI_Overbought && !HasPosition(POSITION_TYPE_BUY))
      OpenBuy();

   if(crossDown && rsi > InpRSI_Oversold && !HasPosition(POSITION_TYPE_SELL))
      OpenSell();

   if(InpUseTrailing)
      TrailingStopLogic();
  }

//+------------------------------------------------------------------+
double Buf(const int handle, const int shift)
  {
   double v[];
   if(CopyBuffer(handle, 0, shift, 1, v) != 1)
      return EMPTY_VALUE;
   return v[0];
  }

//+------------------------------------------------------------------+
bool IsNewBar()
  {
   datetime current = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(current != g_lastBarTime)
     {
      g_lastBarTime = current;
      return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
bool HasPosition(const ENUM_POSITION_TYPE type)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == type)
         return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
void CloseByType(const ENUM_POSITION_TYPE type)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == type)
         g_trade.PositionClose(ticket);
     }
  }

//+------------------------------------------------------------------+
void OpenBuy()
  {
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double sl = ask - InpStopLossPts * _Point;
   double tp = ask + InpTakeProfitPts * _Point;
   if(g_trade.Buy(InpLots, _Symbol, ask, sl, tp, "AuraFX Pro Lite Buy"))
      g_lastSignalText = "BUY";
  }

//+------------------------------------------------------------------+
void OpenSell()
  {
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = bid + InpStopLossPts * _Point;
   double tp = bid - InpTakeProfitPts * _Point;
   if(g_trade.Sell(InpLots, _Symbol, bid, sl, tp, "AuraFX Pro Lite Sell"))
      g_lastSignalText = "SELL";
  }

//+------------------------------------------------------------------+
void TrailingStopLogic()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) continue;

      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      ENUM_POSITION_TYPE ptype = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

      if(ptype == POSITION_TYPE_BUY)
        {
         double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         double newSL = bid - InpTrailingStopPts * _Point;
         if(newSL > currentSL + _Point)
            g_trade.PositionModify(ticket, newSL, currentTP);
        }
      else if(ptype == POSITION_TYPE_SELL)
        {
         double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double newSL = ask + InpTrailingStopPts * _Point;
         if(currentSL == 0.0 || newSL < currentSL - _Point)
            g_trade.PositionModify(ticket, newSL, currentTP);
        }
     }
  }

//+------------------------------------------------------------------+
void CreateDashboard()
  {
   string bg = AFX_PREFIX + "BG";
   ObjectCreate(ChartID(), bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(ChartID(), bg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(ChartID(), bg, OBJPROP_XDISTANCE, InpPanelX);
   ObjectSetInteger(ChartID(), bg, OBJPROP_YDISTANCE, InpPanelY);
   ObjectSetInteger(ChartID(), bg, OBJPROP_XSIZE, 330);
   ObjectSetInteger(ChartID(), bg, OBJPROP_YSIZE, 230);
   ObjectSetInteger(ChartID(), bg, OBJPROP_BGCOLOR, AFX_BG);
   ObjectSetInteger(ChartID(), bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(ChartID(), bg, OBJPROP_COLOR, AFX_BORDER);
   ObjectSetInteger(ChartID(), bg, OBJPROP_BACK, false);

   CreateLabel("Title", "AuraFX Pro — Live Dashboard", InpPanelX + 12, InpPanelY + 12, AFX_GOLD, 11, true);
   CreateLabel("Status", "Status: Waiting for signal…", InpPanelX + 12, InpPanelY + 36, AFX_MUTED, 9, false);
   CreateLabel("Equity", "Equity: --", InpPanelX + 12, InpPanelY + 58, AFX_TEXT, 9, false);
   CreateLabel("Balance", "Balance: --", InpPanelX + 12, InpPanelY + 80, AFX_TEXT, 9, false);
   CreateLabel("Positions", "Positions: 0", InpPanelX + 12, InpPanelY + 102, AFX_TEXT, 9, false);
   CreateLabel("LastSignal", "Last Signal: None", InpPanelX + 12, InpPanelY + 124, AFX_TEXT, 9, false);
   CreateLabel("ServerTime", "Server Time: --", InpPanelX + 12, InpPanelY + 146, AFX_MUTED, 9, false);
   CreateLabel("Disclaimer", "Educational only — not financial advice", InpPanelX + 12, InpPanelY + 172, AFX_MUTED, 8, false);
  }

//+------------------------------------------------------------------+
void UpdateDashboard()
  {
   int myPos = CountMyPositions();
   string status = "Waiting for signal…";
   color statusClr = AFX_MUTED;

   if(HasPosition(POSITION_TYPE_BUY))
     {
      status = "Long position open";
      statusClr = AFX_BUY;
     }
   else if(HasPosition(POSITION_TYPE_SELL))
     {
      status = "Short position open";
      statusClr = AFX_SELL;
     }

   SetLabelText("Status", "Status: " + status, statusClr);
   SetLabelText("Equity", "Equity: " + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2));
   SetLabelText("Balance", "Balance: " + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2));
   SetLabelText("Positions", "Positions: " + IntegerToString(myPos));

   color sigClr = AFX_TEXT;
   if(g_lastSignalText == "BUY") sigClr = AFX_BUY;
   if(g_lastSignalText == "SELL") sigClr = AFX_SELL;
   SetLabelText("LastSignal", "Last Signal: " + g_lastSignalText, sigClr);
   SetLabelText("ServerTime", "Server Time: " + TimeToString(TimeCurrent(), TIME_DATE | TIME_MINUTES));
  }

//+------------------------------------------------------------------+
int CountMyPositions()
  {
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) continue;
      n++;
     }
   return n;
  }

//+------------------------------------------------------------------+
void CreateLabel(const string id, const string text, const int x, const int y,
                 const color clr, const int size, const bool bold)
  {
   string name = AFX_PREFIX + id;
   ObjectCreate(ChartID(), name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(ChartID(), name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(ChartID(), name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(ChartID(), name, OBJPROP_YDISTANCE, y);
   ObjectSetString(ChartID(), name, OBJPROP_TEXT, text);
   ObjectSetInteger(ChartID(), name, OBJPROP_COLOR, clr);
   ObjectSetInteger(ChartID(), name, OBJPROP_FONTSIZE, size);
   ObjectSetString(ChartID(), name, OBJPROP_FONT, bold ? "Segoe UI Semibold" : "Segoe UI");
  }

//+------------------------------------------------------------------+
void SetLabelText(const string id, const string text, const color clr = clrNONE)
  {
   string name = AFX_PREFIX + id;
   ObjectSetString(ChartID(), name, OBJPROP_TEXT, text);
   if(clr != clrNONE)
      ObjectSetInteger(ChartID(), name, OBJPROP_COLOR, clr);
  }
//+------------------------------------------------------------------+
