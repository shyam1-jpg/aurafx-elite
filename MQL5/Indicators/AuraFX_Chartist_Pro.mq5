//+------------------------------------------------------------------+
//| AuraFX_Chartist_Pro.mq5 — Colorful candles + pattern highlights  |
//| Breakouts, FVG, engulfing, SL/TP lines — chartist-style visuals  |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Chartist-style: color candles, breakout zones, SL/TP. Educational only."
#property indicator_chart_window
#property indicator_buffers 5
#property indicator_plots   1

#property indicator_label1  "AuraFX Chartist"
#property indicator_type1   DRAW_COLOR_CANDLES

// Vibrant chartist palette (8 candle types)
#property indicator_color1  C'0,210,130'      // 0 bull
#property indicator_color2  C'255,75,75'      // 1 bear
#property indicator_color3  C'255,200,0'      // 2 breakout up
#property indicator_color4  C'255,0,140'      // 3 breakout down
#property indicator_color5  C'0,220,255'      // 4 bullish pattern
#property indicator_color6  C'255,130,40'     // 5 bearish pattern
#property indicator_color7  C'80,255,60'     // 6 buy signal
#property indicator_color8  C'220,50,255'     // 7 sell signal

#include <AuraFX_Core.mqh>
#include <AuraFX_Structure.mqh>

input group "=== Colorful candles ==="
input bool   InpColorCandles     = true;
input bool   InpHighlightPatterns = true;
input bool   InpShowBreakoutZones = true;
input bool   InpShowFVGZones      = true;

input group "=== Stop-loss & take-profit ==="
input bool   InpShowSLTP         = true;
input double InpSlAtrMult        = 1.5;
input double InpTpRR             = 2.0;
input int    InpMaxSLTPBars      = 40;      // How many recent signals show SL/TP

input group "=== Panel ==="
input bool   InpShowLegend       = true;
input int    InpLegendX          = 12;
input int    InpLegendY          = 12;

// Candle color indexes
#define CLR_BULL      0
#define CLR_BEAR      1
#define CLR_BRK_UP    2
#define CLR_BRK_DN    3
#define CLR_PAT_BULL  4
#define CLR_PAT_BEAR  5
#define CLR_SIG_BUY   6
#define CLR_SIG_SELL  7

double BufOpen[];
double BufHigh[];
double BufLow[];
double BufClose[];
double BufColor[];

int g_hAtr = INVALID_HANDLE;
const string PFX = "AFX_CH";

//+------------------------------------------------------------------+
int OnInit()
  {
   SetIndexBuffer(0, BufOpen,  INDICATOR_DATA);
   SetIndexBuffer(1, BufHigh,  INDICATOR_DATA);
   SetIndexBuffer(2, BufLow,   INDICATOR_DATA);
   SetIndexBuffer(3, BufClose, INDICATOR_DATA);
   SetIndexBuffer(4, BufColor, INDICATOR_COLOR_INDEX);

   PlotIndexSetInteger(0, PLOT_COLOR_INDEXES, 8);
   PlotIndexSetInteger(0, PLOT_DRAW_TYPE, DRAW_COLOR_CANDLES);

   g_hAtr = iATR(_Symbol, PERIOD_CURRENT, 14);
   if(g_hAtr == INVALID_HANDLE)
      return INIT_FAILED;

   IndicatorSetString(INDICATOR_SHORTNAME, "AuraFX Chartist Pro");
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(g_hAtr != INVALID_HANDLE) IndicatorRelease(g_hAtr);
   ObjectsDeleteAll(ChartID(), PFX);
  }

//+------------------------------------------------------------------+
double GetAtr(const int shift)
  {
   double a[];
   ArraySetAsSeries(a, true);
   if(CopyBuffer(g_hAtr, 0, shift, 1, a) != 1) return 0;
   return a[0];
  }

//+------------------------------------------------------------------+
// Series arrays: index 0 = newest bar, higher index = older bars
bool IsSwingHigh(const double &high[], const int i, const int left, const int right, const int total)
  {
   if(i + left >= total || i - right < 0) return false;
   for(int j = 1; j <= left; j++)
      if(high[i] <= high[i + j]) return false;
   for(int j = 1; j <= right; j++)
      if(high[i] <= high[i - j]) return false;
   return true;
  }

bool IsSwingLow(const double &low[], const int i, const int left, const int right, const int total)
  {
   if(i + left >= total || i - right < 0) return false;
   for(int j = 1; j <= left; j++)
      if(low[i] >= low[i + j]) return false;
   for(int j = 1; j <= right; j++)
      if(low[i] >= low[i - j]) return false;
   return true;
  }

bool IsBullEngulfing(const double &o[], const double &h[], const double &l[],
                     const double &c[], const int i)
  {
   if(i + 1 >= ArraySize(c)) return false;
   bool prevBear = c[i + 1] < o[i + 1];
   bool currBull = c[i] > o[i];
   return prevBear && currBull && o[i] <= c[i + 1] && c[i] >= o[i + 1];
  }

bool IsBearEngulfing(const double &o[], const double &h[], const double &l[],
                     const double &c[], const int i)
  {
   if(i + 1 >= ArraySize(c)) return false;
   bool prevBull = c[i + 1] > o[i + 1];
   bool currBear = c[i] < o[i];
   return prevBull && currBear && o[i] >= c[i + 1] && c[i] <= o[i + 1];
  }

bool IsHammer(const double &o[], const double &h[], const double &l[],
              const double &c[], const int i)
  {
   double body = MathAbs(c[i] - o[i]);
   double lower = MathMin(o[i], c[i]) - l[i];
   double upper = h[i] - MathMax(o[i], c[i]);
   if(body <= 0) return false;
   return lower >= body * 2.0 && upper <= body * 0.5;
  }

bool IsShootingStar(const double &o[], const double &h[], const double &l[],
                    const double &c[], const int i)
  {
   double body = MathAbs(c[i] - o[i]);
   double lower = MathMin(o[i], c[i]) - l[i];
   double upper = h[i] - MathMax(o[i], c[i]);
   if(body <= 0) return false;
   return upper >= body * 2.0 && lower <= body * 0.5;
  }

bool IsBullFVG(const double &h[], const double &l[], const int i)
  {
   if(i + 2 >= ArraySize(h)) return false;
   return h[i + 2] < l[i];
  }

bool IsBearFVG(const double &h[], const double &l[], const int i)
  {
   if(i + 2 >= ArraySize(h)) return false;
   return l[i + 2] > h[i];
  }

bool DetectBosUp(const double &close[], const double &high[], const int i, const int total)
  {
   double sh = high[i + 3];
   for(int k = i + 2; k <= i + 12 && k < total; k++)
      if(IsSwingHigh(high, k, 2, 2, total) && high[k] > sh) sh = high[k];
   return (close[i] > sh && close[i + 1] <= sh);
  }

bool DetectBosDown(const double &close[], const double &low[], const int i, const int total)
  {
   double sl = low[i + 3];
   for(int k = i + 2; k <= i + 12 && k < total; k++)
      if(IsSwingLow(low, k, 2, 2, total) && low[k] < sl) sl = low[k];
   return (close[i] < sl && close[i + 1] >= sl);
  }

//+------------------------------------------------------------------+
string ObjName(const datetime t, const string tag)
  {
   return PFX + "_" + tag + "_" + IntegerToString((long)t);
  }

void DrawHLine(const string name, const datetime t1, const datetime t2,
               const double price, const color clr, const string txt, const ENUM_LINE_STYLE style)
  {
   if(ObjectFind(ChartID(), name) < 0)
      ObjectCreate(ChartID(), name, OBJ_TREND, 0, t1, price, t2, price);
   ObjectSetInteger(ChartID(), name, OBJPROP_TIME, 0, t1);
   ObjectSetDouble(ChartID(), name, OBJPROP_PRICE, 0, price);
   ObjectSetInteger(ChartID(), name, OBJPROP_TIME, 1, t2);
   ObjectSetDouble(ChartID(), name, OBJPROP_PRICE, 1, price);
   ObjectSetInteger(ChartID(), name, OBJPROP_COLOR, clr);
   ObjectSetInteger(ChartID(), name, OBJPROP_STYLE, style);
   ObjectSetInteger(ChartID(), name, OBJPROP_WIDTH, 2);
   ObjectSetInteger(ChartID(), name, OBJPROP_RAY_RIGHT, false);
   ObjectSetInteger(ChartID(), name, OBJPROP_BACK, true);
   ObjectSetInteger(ChartID(), name, OBJPROP_SELECTABLE, false);
   ObjectSetString(ChartID(), name, OBJPROP_TEXT, txt);
  }

void DrawZoneRect(const string name, const datetime t1, const datetime t2,
                  const double top, const double bot, const color fill, const string txt)
  {
   if(ObjectFind(ChartID(), name) < 0)
      ObjectCreate(ChartID(), name, OBJ_RECTANGLE, 0, t1, top, t2, bot);
   ObjectSetInteger(ChartID(), name, OBJPROP_TIME, 0, t1);
   ObjectSetDouble(ChartID(), name, OBJPROP_PRICE, 0, top);
   ObjectSetInteger(ChartID(), name, OBJPROP_TIME, 1, t2);
   ObjectSetDouble(ChartID(), name, OBJPROP_PRICE, 1, bot);
   ObjectSetInteger(ChartID(), name, OBJPROP_COLOR, fill);
   ObjectSetInteger(ChartID(), name, OBJPROP_FILL, true);
   ObjectSetInteger(ChartID(), name, OBJPROP_BACK, true);
   ObjectSetInteger(ChartID(), name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(ChartID(), name, OBJPROP_SELECTABLE, false);
   ObjectSetString(ChartID(), name, OBJPROP_TEXT, txt);
  }

void DrawPatternLabel(const string name, const datetime t, const double price,
                      const string txt, const color clr)
  {
   if(ObjectFind(ChartID(), name) < 0)
      ObjectCreate(ChartID(), name, OBJ_TEXT, 0, t, price);
   ObjectSetInteger(ChartID(), name, OBJPROP_TIME, 0, t);
   ObjectSetDouble(ChartID(), name, OBJPROP_PRICE, 0, price);
   ObjectSetString(ChartID(), name, OBJPROP_TEXT, txt);
   ObjectSetString(ChartID(), name, OBJPROP_FONT, "Segoe UI Semibold");
   ObjectSetInteger(ChartID(), name, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(ChartID(), name, OBJPROP_COLOR, clr);
   ObjectSetInteger(ChartID(), name, OBJPROP_ANCHOR, ANCHOR_LOWER);
   ObjectSetInteger(ChartID(), name, OBJPROP_SELECTABLE, false);
  }

void DrawLegend()
  {
   if(!InpShowLegend) return;
   string panel = PFX + "_LEGEND";
   int w = 220, h = 198;
   if(ObjectFind(ChartID(), panel) < 0)
     {
      ObjectCreate(ChartID(), panel, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), panel, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
      ObjectSetInteger(ChartID(), panel, OBJPROP_XDISTANCE, InpLegendX);
      ObjectSetInteger(ChartID(), panel, OBJPROP_YDISTANCE, InpLegendY);
      ObjectSetInteger(ChartID(), panel, OBJPROP_XSIZE, w);
      ObjectSetInteger(ChartID(), panel, OBJPROP_YSIZE, h);
      ObjectSetInteger(ChartID(), panel, OBJPROP_BGCOLOR, C'14,16,28');
      ObjectSetInteger(ChartID(), panel, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(ChartID(), panel, OBJPROP_COLOR, AURA_COLOR_GOLD_DIM);
      ObjectSetInteger(ChartID(), panel, OBJPROP_BACK, false);
      ObjectSetInteger(ChartID(), panel, OBJPROP_SELECTABLE, false);
     }

   string rows[9];
   rows[0] = "AuraFX CHARTIST PRO";
   rows[1] = "■ Bull candle";
   rows[2] = "■ Bear candle";
   rows[3] = "■ Breakout UP";
   rows[4] = "■ Breakout DOWN";
   rows[5] = "■ Bull pattern";
   rows[6] = "■ Bear pattern";
   rows[7] = "— SL (red) / TP (green)";
   rows[8] = "Zones = FVG / breakout";

   color cols[9] = {AURA_COLOR_GOLD, C'0,210,130', C'255,75,75', C'255,200,0', C'255,0,140',
                    C'0,220,255', C'255,130,40', C'255,75,75', AURA_COLOR_MUTED};

   for(int i = 0; i < 9; i++)
     {
      string nm = PFX + "_LG" + IntegerToString(i);
      if(ObjectFind(ChartID(), nm) < 0)
        {
         ObjectCreate(ChartID(), nm, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(ChartID(), nm, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
         ObjectSetInteger(ChartID(), nm, OBJPROP_SELECTABLE, false);
        }
      ObjectSetInteger(ChartID(), nm, OBJPROP_XDISTANCE, InpLegendX + 12);
      ObjectSetInteger(ChartID(), nm, OBJPROP_YDISTANCE, InpLegendY + 10 + i * 20);
      ObjectSetString(ChartID(), nm, OBJPROP_FONT, i == 0 ? "Segoe UI Semibold" : "Segoe UI");
      ObjectSetInteger(ChartID(), nm, OBJPROP_FONTSIZE, i == 0 ? 10 : 9);
      ObjectSetString(ChartID(), nm, OBJPROP_TEXT, rows[i]);
      ObjectSetInteger(ChartID(), nm, OBJPROP_COLOR, cols[i]);
     }
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
   if(rates_total < 60)
      return 0;

   ArraySetAsSeries(time,  true);
   ArraySetAsSeries(open,   true);
   ArraySetAsSeries(high,   true);
   ArraySetAsSeries(low,    true);
   ArraySetAsSeries(close,  true);
   ArraySetAsSeries(BufOpen,  false);
   ArraySetAsSeries(BufHigh,  false);
   ArraySetAsSeries(BufLow,   false);
   ArraySetAsSeries(BufClose, false);
   ArraySetAsSeries(BufColor, false);

   int series_total = rates_total;
   int lookback = MathMin(350, series_total - 5);
   int start = (prev_calculated > 2) ? MathMin(prev_calculated - 2, lookback) : lookback;

   if(prev_calculated <= 2)
      ObjectsDeleteAll(ChartID(), PFX);

   int sltpCount = 0;

   for(int s = start; s >= 1; s--)
     {
      int i = series_total - 1 - s;
      if(i < 1) continue;

      BufOpen[i]  = open[s];
      BufHigh[i]  = high[s];
      BufLow[i]   = low[s];
      BufClose[i] = close[s];

      int clr = (close[s] >= open[s]) ? CLR_BULL : CLR_BEAR;

      string patName = "";
      color patClr = AURA_COLOR_TEXT;

      if(InpHighlightPatterns)
        {
         if(IsBullEngulfing(open, high, low, close, s))
           { clr = CLR_PAT_BULL; patName = "Bull Engulf"; patClr = C'0,220,255'; }
         else if(IsBearEngulfing(open, high, low, close, s))
           { clr = CLR_PAT_BEAR; patName = "Bear Engulf"; patClr = C'255,130,40'; }
         else if(IsHammer(open, high, low, close, s))
           { clr = CLR_PAT_BULL; patName = "Hammer"; patClr = C'0,220,255'; }
         else if(IsShootingStar(open, high, low, close, s))
           { clr = CLR_PAT_BEAR; patName = "Shooting Star"; patClr = C'255,130,40'; }
        }

      if(DetectBosUp(close, high, s, series_total))
        {
         clr = CLR_BRK_UP;
         patName = "BOS ▲ Breakout";
         patClr = C'255,200,0';
         if(InpShowBreakoutZones)
           {
            datetime t2 = time[s];
            datetime t1 = (s + 4 < series_total) ? time[s + 4] : time[s];
            double top = high[s] + GetAtr(s) * 0.15;
            double bot = low[s] - GetAtr(s) * 0.05;
            DrawZoneRect(ObjName(time[s], "BRKUP"), t1, t2, top, bot, C'255,200,0', "Breakout UP");
           }
        }
      else if(DetectBosDown(close, low, s, series_total))
        {
         clr = CLR_BRK_DN;
         patName = "BOS ▼ Breakout";
         patClr = C'255,0,140';
         if(InpShowBreakoutZones)
           {
            datetime t2 = time[s];
            datetime t1 = (s + 4 < series_total) ? time[s + 4] : time[s];
            double top = high[s] + GetAtr(s) * 0.05;
            double bot = low[s] - GetAtr(s) * 0.15;
            DrawZoneRect(ObjName(time[s], "BRKDN"), t1, t2, top, bot, C'255,0,140', "Breakout DOWN");
           }
        }

      if(InpShowFVGZones)
        {
         if(IsBullFVG(high, low, s))
           {
            datetime t2 = time[s];
            datetime t1 = time[s + 2];
            DrawZoneRect(ObjName(time[s], "FVG_B"), t1, t2, low[s], high[s + 2],
                         C'0,180,255', "Bull FVG");
            if(patName == "") { patName = "Bull FVG"; patClr = C'0,180,255'; }
           }
         if(IsBearFVG(high, low, s))
           {
            datetime t2 = time[s];
            datetime t1 = time[s + 2];
            DrawZoneRect(ObjName(time[s], "FVG_S"), t1, t2, low[s + 2], high[s],
                         C'255,100,50', "Bear FVG");
            if(patName == "") { patName = "Bear FVG"; patClr = C'255,100,50'; }
           }
        }

      ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, s, 62, 38, 0.30);
      if(sig == AURA_SIGNAL_BUY)
        {
         clr = CLR_SIG_BUY;
         patName = "★ BUY";
         patClr = C'80,255,60';
        }
      else if(sig == AURA_SIGNAL_SELL)
        {
         clr = CLR_SIG_SELL;
         patName = "★ SELL";
         patClr = C'220,50,255';
        }

      if(!InpColorCandles)
         clr = (close[s] >= open[s]) ? CLR_BULL : CLR_BEAR;

      BufColor[i] = clr;

      if(patName != "")
        {
         double y = (StringFind(patName, "SELL") >= 0 || StringFind(patName, "Bear") >= 0 ||
                     StringFind(patName, "DOWN") >= 0 || StringFind(patName, "Star") >= 0)
                    ? high[s] + GetAtr(s) * 0.25
                    : low[s] - GetAtr(s) * 0.25;
         DrawPatternLabel(ObjName(time[s], "LBL"), time[s], y, patName, patClr);
        }

      if(InpShowSLTP && sig != AURA_SIGNAL_NONE && sltpCount < InpMaxSLTPBars)
        {
         double atr = GetAtr(s);
         if(atr <= 0) atr = (high[s] - low[s]);
         datetime tEnd = time[MathMax(0, s - 8)];
         double sl = 0, tp = 0;
         if(sig == AURA_SIGNAL_BUY)
           {
            sl = low[s] - atr * InpSlAtrMult;
            double risk = close[s] - sl;
            tp = close[s] + risk * InpTpRR;
           }
         else
           {
            sl = high[s] + atr * InpSlAtrMult;
            double risk = sl - close[s];
            tp = close[s] - risk * InpTpRR;
           }
         DrawHLine(ObjName(time[s], "SL"), time[s], tEnd, sl, C'255,60,60', "SL", STYLE_DASH);
         DrawHLine(ObjName(time[s], "TP"), time[s], tEnd, tp, C'50,220,100', "TP", STYLE_DASH);
         sltpCount++;
        }
     }

   DrawLegend();
   ChartRedraw();
   return rates_total;
  }
//+------------------------------------------------------------------+
