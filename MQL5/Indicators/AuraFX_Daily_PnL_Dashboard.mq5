//+------------------------------------------------------------------+
//| AuraFX_Daily_PnL_Dashboard.mq5 — today profit/loss all pairs     |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Daily P&L tracker — all pairs, wins/losses, like pro trading apps."
#property indicator_chart_window
#property indicator_plots 0

#include <AuraFX_Core.mqh>

input int InpPanelX = 12;
input int InpPanelY = 280;
input bool InpCountAllEAs = true;  // All AuraFX trades, not one magic only

const string PFX = "AFX_DAILY";

datetime DayStart()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   dt.hour = 0; dt.min = 0; dt.sec = 0;
   return StructToTime(dt);
  }

bool IsAuraMagic(const long magic)
  {
   if(!InpCountAllEAs) return true;
   long m[] = {20260830,20260815,20260801,20260701,202605,202606,20260622,20260702,20260703,20260704,20260820,20260825,20260624,20260623};
   for(int i = 0; i < ArraySize(m); i++)
      if(magic == m[i]) return true;
   return (magic >= 202605 && magic <= 20260899);
  }

void CollectDay(double &closedPnL, int &trades, int &wins, int &losses)
  {
   closedPnL = 0; trades = 0; wins = 0; losses = 0;
   datetime from = DayStart();
   if(!HistorySelect(from, TimeCurrent())) return;

   for(int d = 0; d < HistoryDealsTotal(); d++)
     {
      ulong tk = HistoryDealGetTicket(d);
      if(tk == 0) continue;
      if(HistoryDealGetInteger(tk, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
      long mag = HistoryDealGetInteger(tk, DEAL_MAGIC);
      if(InpCountAllEAs && !IsAuraMagic(mag)) continue;

      double p = HistoryDealGetDouble(tk, DEAL_PROFIT)
               + HistoryDealGetDouble(tk, DEAL_SWAP)
               + HistoryDealGetDouble(tk, DEAL_COMMISSION);
      closedPnL += p;
      trades++;
      if(p > 0) wins++; else if(p < 0) losses++;
     }
  }

double FloatingPnL()
  {
   double f = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!PositionSelectByTicket(PositionGetTicket(i))) continue;
      if(InpCountAllEAs && !IsAuraMagic(PositionGetInteger(POSITION_MAGIC))) continue;
      f += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
     }
   return f;
  }

void SetLbl(const string id, const int y, const string txt, const color c, const int sz=9)
  {
   string n = PFX + id;
   if(ObjectFind(ChartID(), n) < 0)
     {
      ObjectCreate(ChartID(), n, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), n, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetString(ChartID(), n, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(ChartID(), n, OBJPROP_SELECTABLE, false);
     }
   ObjectSetInteger(ChartID(), n, OBJPROP_XDISTANCE, InpPanelX + 12);
   ObjectSetInteger(ChartID(), n, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(ChartID(), n, OBJPROP_FONTSIZE, sz);
   ObjectSetString(ChartID(), n, OBJPROP_TEXT, txt);
   ObjectSetInteger(ChartID(), n, OBJPROP_COLOR, c);
  }

int OnInit()
  {
   IndicatorSetString(INDICATOR_SHORTNAME, "AuraFX Daily P&L");
   EventSetTimer(15);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int r) { EventKillTimer(); ObjectsDeleteAll(ChartID(), PFX); }

void OnTimer() { ChartRedraw(); }

int OnCalculate(const int r,const int p,const datetime &t[],const double &o[],
                const double &h[],const double &l[],const double &c[],
                const long &tv[],const long &v[],const int &s[])
  {
   static datetime last = 0;
   if(TimeCurrent() - last < 10 && last > 0) return r;
   last = TimeCurrent();

   double closed = 0, floating = FloatingPnL();
   int tr = 0, w = 0, lss = 0;
   CollectDay(closed, tr, w, lss);
   double totalDay = closed + floating;
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   string cur = AccountInfoString(ACCOUNT_CURRENCY);
   double wr = (tr > 0) ? 100.0 * w / tr : 0;

   string panel = PFX + "BG";
   if(ObjectFind(ChartID(), panel) < 0)
     {
      ObjectCreate(ChartID(), panel, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), panel, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(ChartID(), panel, OBJPROP_BGCOLOR, C'14,16,28');
      ObjectSetInteger(ChartID(), panel, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(ChartID(), panel, OBJPROP_COLOR, AURA_COLOR_GOLD_DIM);
      ObjectSetInteger(ChartID(), panel, OBJPROP_XSIZE, 300);
      ObjectSetInteger(ChartID(), panel, OBJPROP_YSIZE, 118);
     }
   ObjectSetInteger(ChartID(), panel, OBJPROP_XDISTANCE, InpPanelX);
   ObjectSetInteger(ChartID(), panel, OBJPROP_YDISTANCE, InpPanelY);

   color pc = totalDay >= 0 ? AURA_COLOR_BUY : AURA_COLOR_SELL;
   SetLbl("H", InpPanelY + 8, "AURAFX DAILY P&L", AURA_COLOR_GOLD, 10);
   SetLbl("1", InpPanelY + 28, StringFormat("Today: %+.2f %s  (closed %+.2f + open %+.2f)",
         totalDay, cur, closed, floating), pc, 9);
   SetLbl("2", InpPanelY + 48, StringFormat("Trades today: %d  |  Wins %d  Losses %d  |  WR %.0f%%",
         tr, w, lss, wr), AURA_COLOR_TEXT, 9);
   SetLbl("3", InpPanelY + 68, StringFormat("Balance: %.2f %s  |  %s",
         bal, cur, AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_DEMO?"DEMO":"LIVE"),
         AURA_COLOR_MUTED, 9);
   SetLbl("4", InpPanelY + 88, "All pairs · resets midnight · demo practice", AURA_COLOR_MUTED, 8);

   ChartRedraw();
   return r;
  }
