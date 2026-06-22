//+------------------------------------------------------------------+
//|                                       AuraFX_Pro_Indicator.mq5   |
//|                        Copyright 2026, AuraFX Elite              |
//|  EMA crossover + RSI filter — educational chart signals only.    |
//+------------------------------------------------------------------+
#property copyright "AuraFX Elite"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "AuraFX Pro: EMA crossover with RSI filter. Educational signals — not financial advice."
#property indicator_chart_window
#property indicator_buffers 4
#property indicator_plots   4

#property indicator_label1  "Buy"
#property indicator_type1   DRAW_ARROW
#property indicator_color1  clrLime
#property indicator_label2  "Sell"
#property indicator_type2   DRAW_ARROW
#property indicator_color2  clrRed
#property indicator_label3  "Fast EMA"
#property indicator_type3   DRAW_LINE
#property indicator_color3  C'212,175,55'
#property indicator_label4  "Slow EMA"
#property indicator_type4   DRAW_LINE
#property indicator_color4  C'52,152,219'

input int      InpFastMA_Period  = 9;
input int      InpSlowMA_Period  = 21;
input int      InpRSI_Period     = 14;
input double   InpRSI_Overbought = 70.0;
input double   InpRSI_Oversold   = 30.0;
input int      InpArrowOffsetPts = 15;
input color    InpBuyArrowColor  = C'46,204,113';
input color    InpSellArrowColor = C'231,76,60';

double BuySignal[];
double SellSignal[];
double FastMABuffer[];
double SlowMABuffer[];

int g_hFast = INVALID_HANDLE;
int g_hSlow = INVALID_HANDLE;
int g_hRsi  = INVALID_HANDLE;

//+------------------------------------------------------------------+
int OnInit()
  {
   SetIndexBuffer(0, BuySignal, INDICATOR_DATA);
   SetIndexBuffer(1, SellSignal, INDICATOR_DATA);
   SetIndexBuffer(2, FastMABuffer, INDICATOR_DATA);
   SetIndexBuffer(3, SlowMABuffer, INDICATOR_DATA);

   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_ARROW);
   PlotIndexSetInteger(1, PLOT_DRAW_TYPE, DRAW_ARROW);
   PlotIndexSetInteger(2, PLOT_DRAW_TYPE, DRAW_LINE);
   PlotIndexSetInteger(3, PLOT_DRAW_TYPE, DRAW_LINE);

   PlotIndexSetInteger(0, PLOT_ARROW, 233);
   PlotIndexSetInteger(1, PLOT_ARROW, 234);
   PlotIndexSetInteger(0, PLOT_LINE_COLOR, InpBuyArrowColor);
   PlotIndexSetInteger(1, PLOT_LINE_COLOR, InpSellArrowColor);
   PlotIndexSetDouble(2, PLOT_LINE_WIDTH, 2);
   PlotIndexSetDouble(3, PLOT_LINE_WIDTH, 2);

   g_hFast = iMA(_Symbol, PERIOD_CURRENT, InpFastMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   g_hSlow = iMA(_Symbol, PERIOD_CURRENT, InpSlowMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   g_hRsi  = iRSI(_Symbol, PERIOD_CURRENT, InpRSI_Period, PRICE_CLOSE);

   if(g_hFast == INVALID_HANDLE || g_hSlow == INVALID_HANDLE || g_hRsi == INVALID_HANDLE)
     {
      Print("AuraFX Pro Indicator: failed to create indicator handles.");
      return INIT_FAILED;
     }

   IndicatorSetString(INDICATOR_SHORTNAME, "AuraFX Pro");
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(g_hFast != INVALID_HANDLE) IndicatorRelease(g_hFast);
   if(g_hSlow != INVALID_HANDLE) IndicatorRelease(g_hSlow);
   if(g_hRsi  != INVALID_HANDLE) IndicatorRelease(g_hRsi);
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
   if(rates_total < InpSlowMA_Period + 3)
      return 0;

   int need = rates_total;
   if(CopyBuffer(g_hFast, 0, 0, need, FastMABuffer) <= 0) return prev_calculated;
   if(CopyBuffer(g_hSlow, 0, 0, need, SlowMABuffer) <= 0) return prev_calculated;

   double rsi[];
   ArraySetAsSeries(rsi, false);
   if(CopyBuffer(g_hRsi, 0, 0, need, rsi) <= 0) return prev_calculated;

   int start = (prev_calculated > 2) ? prev_calculated - 2 : InpSlowMA_Period + 1;
   double offset = InpArrowOffsetPts * _Point;

   for(int i = start; i < rates_total; i++)
     {
      BuySignal[i]  = EMPTY_VALUE;
      SellSignal[i] = EMPTY_VALUE;

      if(i < 1) continue;

      bool crossUp   = FastMABuffer[i] > SlowMABuffer[i] && FastMABuffer[i - 1] <= SlowMABuffer[i - 1];
      bool crossDown = FastMABuffer[i] < SlowMABuffer[i] && FastMABuffer[i - 1] >= SlowMABuffer[i - 1];

      if(crossUp && rsi[i] < InpRSI_Overbought)
         BuySignal[i] = low[i] - offset;

      if(crossDown && rsi[i] > InpRSI_Oversold)
         SellSignal[i] = high[i] + offset;
     }

   return rates_total;
  }
//+------------------------------------------------------------------+
