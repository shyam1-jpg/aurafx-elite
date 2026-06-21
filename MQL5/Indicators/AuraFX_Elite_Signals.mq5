//+------------------------------------------------------------------+
//| AuraFX_Elite_Signals.mq5                                         |
//| Elite Forex & Gold Trading Signals — MT5 Marketplace Edition     |
//| Elegant BUY / SELL / COVER signals with performance HUD          |
//+------------------------------------------------------------------+
#property copyright   "AuraFX Labs"
#property link        "https://www.mql5.com"
#property version     "1.00"
#property description "Premium multi-asset signals for Forex pairs and XAUUSD Gold."
#property description "Elegant panel, Sell + Cover alerts, win-rate tracking."
#property indicator_chart_window
#property indicator_buffers 6
#property indicator_plots   3

#property indicator_label1  "AuraFX Buy"
#property indicator_type1   DRAW_ARROW
#property indicator_color1  clrLimeGreen
#property indicator_width1  2

#property indicator_label2  "AuraFX Sell"
#property indicator_type2   DRAW_ARROW
#property indicator_color2  clrCrimson
#property indicator_width2  2

#property indicator_label3  "AuraFX Cover"
#property indicator_type3   DRAW_ARROW
#property indicator_color3  clrDodgerBlue
#property indicator_width3  2

#include <AuraFX_Core.mqh>

//--- Inputs
input group "=== AuraFX Signal Engine ==="
input double InpTargetWinRate   = 76.0;    // Target win rate % (display)
input double InpRsiBuyMax       = 62.0;    // RSI max for BUY
input double InpRsiSellMin      = 38.0;    // RSI min for SELL
input double InpAtrMultMin      = 0.35;    // Min candle vs ATR ratio
input bool   InpAlertsEnabled   = true;    // Popup & push alerts
input bool   InpShowPanel       = true;    // Elegant HUD panel
input int    InpPanelX          = 16;      // Panel X offset
input int    InpPanelY          = 28;      // Panel Y offset

//--- Buffers
double BufBuy[];
double BufSell[];
double BufCover[];
double BufSignalCode[];
double BufWinFlag[];
double BufEntryPrice[];

//--- State
AuraFX_Stats g_stats;
ENUM_AURA_SIGNAL g_lastSignal = AURA_SIGNAL_NONE;
double g_lastEntry = 0;
datetime g_lastBarTime = 0;
const string PANEL_PREFIX = "AURAFX_IND";

//+------------------------------------------------------------------+
int OnInit()
  {
   SetIndexBuffer(0, BufBuy,  INDICATOR_DATA);
   SetIndexBuffer(1, BufSell, INDICATOR_DATA);
   SetIndexBuffer(2, BufCover, INDICATOR_DATA);
   SetIndexBuffer(3, BufSignalCode, INDICATOR_CALCULATIONS);
   SetIndexBuffer(4, BufWinFlag, INDICATOR_CALCULATIONS);
   SetIndexBuffer(5, BufEntryPrice, INDICATOR_CALCULATIONS);

   PlotIndexSetInteger(0, PLOT_ARROW, 233);
   PlotIndexSetInteger(1, PLOT_ARROW, 234);
   PlotIndexSetInteger(2, PLOT_ARROW, 251);

   ArraySetAsSeries(BufBuy, true);
   ArraySetAsSeries(BufSell, true);
   ArraySetAsSeries(BufCover, true);

   g_stats.total = 0;
   g_stats.wins = 0;
   g_stats.losses = 0;
   g_stats.winRate = 0;
   g_stats.targetRate = InpTargetWinRate;

   IndicatorSetString(INDICATOR_SHORTNAME, "AuraFX Elite Signals");
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   AuraFX_DeletePanel(ChartID(), PANEL_PREFIX);
  }

//+------------------------------------------------------------------+
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
   if(rates_total < 100)
      return 0;

   ArraySetAsSeries(time, true);
   ArraySetAsSeries(close, true);
   ArraySetAsSeries(high, true);
   ArraySetAsSeries(low, true);

   int start = (prev_calculated > 2) ? prev_calculated - 1 : 50;
   if(start < 50) start = 50;

   ENUM_AURA_ASSET asset = AuraFX_DetectAsset(_Symbol);
   ENUM_AURA_SIGNAL liveSignal = AURA_SIGNAL_NONE;

   for(int i = start; i >= 1 && !IsStopped(); i--)
     {
      BufBuy[i]   = EMPTY_VALUE;
      BufSell[i]  = EMPTY_VALUE;
      BufCover[i] = EMPTY_VALUE;

      ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, i,
                                                  InpRsiBuyMax, InpRsiSellMin, InpAtrMultMin);
      BufSignalCode[i] = (double)sig;

      if(sig == AURA_SIGNAL_BUY)
         BufBuy[i] = low[i] - (high[i] - low[i]) * 0.15;
      else if(sig == AURA_SIGNAL_SELL)
         BufSell[i] = high[i] + (high[i] - low[i]) * 0.15;
      else if(sig == AURA_SIGNAL_COVER)
         BufCover[i] = close[i];

      // Track win rate on signal change (closed bar logic)
      if(i == 1 && sig != AURA_SIGNAL_NONE && g_lastSignal != AURA_SIGNAL_NONE && g_lastEntry > 0)
        {
         AuraFX_UpdateStats(g_stats, g_lastSignal, g_lastEntry, close[1], InpTargetWinRate);
        }

      if(i == 1)
        {
         liveSignal = sig;
         if(sig != AURA_SIGNAL_NONE && time[1] != g_lastBarTime)
           {
            g_lastBarTime = time[1];
            g_lastSignal = sig;
            g_lastEntry = close[1];
            FireAlert(sig);
           }
        }
     }

   if(InpShowPanel)
      AuraFX_DrawPanel(ChartID(), PANEL_PREFIX, InpPanelX, InpPanelY,
                       liveSignal, g_stats, _Symbol, asset);

   return rates_total;
  }

//+------------------------------------------------------------------+
void FireAlert(const ENUM_AURA_SIGNAL sig)
  {
   if(!InpAlertsEnabled) return;
   string msg = StringFormat("AuraFX Elite | %s | %s | %s",
                             _Symbol,
                             AuraFX_SignalToString(sig),
                             EnumToString((ENUM_AURA_ASSET)AuraFX_DetectAsset(_Symbol)));
   Alert(msg);
   if(TerminalInfoInteger(TERMINAL_NOTIFICATIONS_ENABLED))
      SendNotification(msg);
  }

//+------------------------------------------------------------------+
