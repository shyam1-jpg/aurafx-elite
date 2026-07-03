//+------------------------------------------------------------------+
//| AuraFX_Week_Leaderboard.mq5 — 1-week demo EA comparison panel    |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Ranks all AuraFX EAs by demo profit. Attach to any chart."
#property indicator_chart_window
#property indicator_plots 0

#include <AuraFX_Core.mqh>

input int InpDaysBack     = 7;      // Tournament length (days)
input int InpPanelX       = 12;
input int InpPanelY       = 12;
input int InpRefreshSec   = 30;     // Update interval

struct AuraEAStats
  {
   int    magic;
   string name;
   double profit;
   int    trades;
   int    wins;
   double winRate;
  };

const string PFX = "AFX_LB";
datetime g_lastRefresh = 0;

//+------------------------------------------------------------------+
int OnInit()
  {
   IndicatorSetString(INDICATOR_SHORTNAME, "AuraFX Week Leaderboard");
   EventSetTimer(InpRefreshSec);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int r)
  {
   EventKillTimer();
   ObjectsDeleteAll(ChartID(), PFX);
  }

void OnTimer() { ChartRedraw(); }

int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
  {
   if(TimeCurrent() - g_lastRefresh < InpRefreshSec && g_lastRefresh > 0)
      return rates_total;
   g_lastRefresh = TimeCurrent();
   DrawLeaderboard();
   return rates_total;
  }

//+------------------------------------------------------------------+
void CollectStats(AuraEAStats &list[], const int count, const datetime from)
  {
   ArrayResize(list, count);
   list[0].magic = 20260815; list[0].name = "Universal AI";
   list[1].magic = 20260801; list[1].name = "Quantum Elite";
   list[2].magic = 20260701; list[2].name = "Gold Reaper";
   list[3].magic = 202605;   list[3].name = "Elite EA";
   list[4].magic = 202606;   list[4].name = "Pro EA";
   list[5].magic = 20260622; list[5].name = "Pro Lite";
   list[6].magic = 20260702; list[6].name = "Scalper Pro";
   list[7].magic = 20260703; list[7].name = "Breakout";
   list[8].magic = 20260704; list[8].name = "Pulse Engine";
   if(count > 9) { list[9].magic = 20260820; list[9].name = "Index Force"; }

   for(int i = 0; i < count; i++)
     {
      list[i].profit = 0;
      list[i].trades = 0;
      list[i].wins = 0;
      list[i].winRate = 0;
     }

   if(!HistorySelect(from, TimeCurrent()))
      return;

   int deals = HistoryDealsTotal();
   for(int d = 0; d < deals; d++)
     {
      ulong ticket = HistoryDealGetTicket(d);
      if(ticket == 0) continue;
      if(HistoryDealGetInteger(ticket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;

      long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
      double pnl = HistoryDealGetDouble(ticket, DEAL_PROFIT)
                 + HistoryDealGetDouble(ticket, DEAL_SWAP)
                 + HistoryDealGetDouble(ticket, DEAL_COMMISSION);

      for(int i = 0; i < count; i++)
        {
         if(list[i].magic != magic) continue;
         list[i].profit += pnl;
         list[i].trades++;
         if(pnl > 0) list[i].wins++;
         break;
        }
     }

   for(int i = 0; i < count; i++)
      if(list[i].trades > 0)
         list[i].winRate = 100.0 * list[i].wins / list[i].trades;

   // Add open floating P&L
   for(int p = PositionsTotal() - 1; p >= 0; p--)
     {
      if(!PositionSelectByTicket(PositionGetTicket(p))) continue;
      long magic = PositionGetInteger(POSITION_MAGIC);
      double fl = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      for(int i = 0; i < count; i++)
        {
         if(list[i].magic == magic)
           {
            list[i].profit += fl;
            break;
           }
        }
     }
  }

void SortByProfit(AuraEAStats &list[], const int count)
  {
   for(int i = 0; i < count - 1; i++)
      for(int j = i + 1; j < count; j++)
        {
         if(list[j].profit > list[i].profit)
           {
            AuraEAStats tmp = list[i];
            list[i] = list[j];
            list[j] = tmp;
           }
        }
  }

void DrawLeaderboard()
  {
   const int N = 10;
   AuraEAStats stats[];
   datetime from = TimeCurrent() - InpDaysBack * 86400;
   CollectStats(stats, N, from);
   SortByProfit(stats, N);

   double totalProfit = 0;
   int totalTrades = 0;
   for(int i = 0; i < N; i++)
     {
      totalProfit += stats[i].profit;
      totalTrades += stats[i].trades;
     }

   int panelH = 28 + N * 22 + 50;
   string panel = PFX + "_P";
   if(ObjectFind(ChartID(), panel) < 0)
     {
      ObjectCreate(ChartID(), panel, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), panel, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(ChartID(), panel, OBJPROP_BGCOLOR, C'14,16,28');
      ObjectSetInteger(ChartID(), panel, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(ChartID(), panel, OBJPROP_COLOR, AURA_COLOR_GOLD_DIM);
      ObjectSetInteger(ChartID(), panel, OBJPROP_BACK, false);
      ObjectSetInteger(ChartID(), panel, OBJPROP_SELECTABLE, false);
     }
   ObjectSetInteger(ChartID(), panel, OBJPROP_XDISTANCE, InpPanelX);
   ObjectSetInteger(ChartID(), panel, OBJPROP_YDISTANCE, InpPanelY);
   ObjectSetInteger(ChartID(), panel, OBJPROP_XSIZE, 340);
   ObjectSetInteger(ChartID(), panel, OBJPROP_YSIZE, panelH);

   string hdr = PFX + "_H";
   SetLabel(hdr, InpPanelX + 12, InpPanelY + 8, "AURAFX 1-WEEK DEMO TOURNAMENT", AURA_COLOR_GOLD, 11, true);

   string sub = PFX + "_S";
   SetLabel(sub, InpPanelX + 12, InpPanelY + 28,
      StringFormat("Last %d days · Account %s · Total $%.2f · %d closed trades",
                   InpDaysBack,
                   AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO ? "DEMO" : "LIVE!",
                   totalProfit, totalTrades),
      AURA_COLOR_MUTED, 8, false);

   for(int i = 0; i < N; i++)
     {
      string rank = (i == 0) ? "1st" : (i == 1) ? "2nd" : (i == 2) ? "3rd" : IntegerToString(i + 1) + "th";
      color c = AURA_COLOR_TEXT;
      if(stats[i].profit > 0) c = AURA_COLOR_BUY;
      if(stats[i].profit < 0) c = AURA_COLOR_SELL;
      if(i == 0 && stats[i].trades > 0) c = AURA_COLOR_GOLD;

      string line = PFX + "_L" + IntegerToString(i);
      string txt = StringFormat("%s  %-14s  $%8.2f   %d tr  %.0f%% WR",
                                rank, stats[i].name, stats[i].profit, stats[i].trades, stats[i].winRate);
      SetLabel(line, InpPanelX + 12, InpPanelY + 48 + i * 22, txt, c, 9, false);
     }

   string foot = PFX + "_F";
   SetLabel(foot, InpPanelX + 12, InpPanelY + 48 + N * 22 + 4,
      "Winner = most $ profit after 7 days · Demo only", AURA_COLOR_MUTED, 8, false);

   ChartRedraw();
  }

void SetLabel(const string name, const int x, const int y, const string text,
              const color clr, const int size, const bool bold)
  {
   if(ObjectFind(ChartID(), name) < 0)
     {
      ObjectCreate(ChartID(), name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(ChartID(), name, OBJPROP_SELECTABLE, false);
     }
   ObjectSetInteger(ChartID(), name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(ChartID(), name, OBJPROP_YDISTANCE, y);
   ObjectSetString(ChartID(), name, OBJPROP_FONT, bold ? "Segoe UI Semibold" : "Segoe UI");
   ObjectSetInteger(ChartID(), name, OBJPROP_FONTSIZE, size);
   ObjectSetString(ChartID(), name, OBJPROP_TEXT, text);
   ObjectSetInteger(ChartID(), name, OBJPROP_COLOR, clr);
  }
