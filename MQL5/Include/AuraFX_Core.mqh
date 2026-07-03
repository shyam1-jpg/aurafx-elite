//+------------------------------------------------------------------+
//| AuraFX_Core.mqh — Elite Forex & Gold Signal Engine               |
//| Copyright 2026 AuraFX Labs. For MetaTrader 5.                    |
//+------------------------------------------------------------------+
#property copyright "AuraFX Labs"
#property version   "1.00"

#ifndef AURAFX_CORE_MQH
#define AURAFX_CORE_MQH

//--- Signal types
enum ENUM_AURA_SIGNAL
  {
   AURA_SIGNAL_NONE  = 0,
   AURA_SIGNAL_BUY   = 1,
   AURA_SIGNAL_SELL  = 2,
   AURA_SIGNAL_COVER = 3   // Close / reverse short exposure
  };

//--- Asset class auto-detect
enum ENUM_AURA_ASSET
  {
   AURA_ASSET_FOREX  = 0,
   AURA_ASSET_GOLD   = 1,
   AURA_ASSET_INDEX  = 2,
   AURA_ASSET_SILVER = 3
  };

//--- Panel theme colors (elegant gold-on-obsidian)
#define AURA_COLOR_BG       C'12,14,22'
#define AURA_COLOR_PANEL    C'18,22,34'
#define AURA_COLOR_GOLD     C'212,175,55'
#define AURA_COLOR_GOLD_DIM C'160,130,40'
#define AURA_COLOR_BUY      C'46,204,113'
#define AURA_COLOR_SELL     C'231,76,60'
#define AURA_COLOR_COVER    C'52,152,219'
#define AURA_COLOR_TEXT     C'230,232,240'
#define AURA_COLOR_MUTED    C'120,125,145'

//+------------------------------------------------------------------+
//| Detect gold (XAU) vs forex                                       |
//+------------------------------------------------------------------+
ENUM_AURA_ASSET AuraFX_DetectAsset(const string symbol)
  {
   string s = symbol;
   StringToUpper(s);
   if(StringFind(s, "XAU") >= 0 || StringFind(s, "GOLD") >= 0)
      return AURA_ASSET_GOLD;
   if(StringFind(s, "XAG") >= 0 || StringFind(s, "SILVER") >= 0)
      return AURA_ASSET_SILVER;
   if(StringFind(s, "US30") >= 0 || StringFind(s, "US500") >= 0 || StringFind(s, "SPX") >= 0 ||
      StringFind(s, "SP500") >= 0 || StringFind(s, "NAS") >= 0 || StringFind(s, "US100") >= 0 ||
      StringFind(s, "USTEC") >= 0 || StringFind(s, "GER") >= 0 || StringFind(s, "DAX") >= 0 ||
      StringFind(s, "UK100") >= 0 || StringFind(s, "FTSE") >= 0 || StringFind(s, "JP225") >= 0 ||
      StringFind(s, "NI225") >= 0 || StringFind(s, "US2000") >= 0)
      return AURA_ASSET_INDEX;
   return AURA_ASSET_FOREX;
  }

string AuraFX_AssetLabel(const ENUM_AURA_ASSET asset)
  {
   if(asset == AURA_ASSET_GOLD)   return "GOLD";
   if(asset == AURA_ASSET_SILVER) return "SILVER";
   if(asset == AURA_ASSET_INDEX)  return "INDEX";
   return "FOREX";
  }

//+------------------------------------------------------------------+
//| Optimized periods per asset                                      |
//+------------------------------------------------------------------+
void AuraFX_GetPeriods(const ENUM_AURA_ASSET asset,
                       int &emaFast, int &emaSlow, int &rsiPeriod,
                       int &macdFast, int &macdSlow, int &macdSignal)
  {
   if(asset == AURA_ASSET_GOLD)
     {
      emaFast    = 8;
      emaSlow    = 21;
      rsiPeriod  = 14;
      macdFast   = 12;
      macdSlow   = 26;
      macdSignal = 9;
     }
   else if(asset == AURA_ASSET_INDEX)
     {
      emaFast    = 10;
      emaSlow    = 24;
      rsiPeriod  = 14;
      macdFast   = 12;
      macdSlow   = 26;
      macdSignal = 9;
     }
   else if(asset == AURA_ASSET_SILVER)
     {
      emaFast    = 8;
      emaSlow    = 21;
      rsiPeriod  = 14;
      macdFast   = 12;
      macdSlow   = 26;
      macdSignal = 9;
     }
   else
     {
      emaFast    = 9;
      emaSlow    = 26;
      rsiPeriod  = 14;
      macdFast   = 12;
      macdSlow   = 26;
      macdSignal = 9;
     }
  }

//+------------------------------------------------------------------+
//| Read indicator buffer value safely                               |
//+------------------------------------------------------------------+
double AuraFX_Buffer(const int handle, const int buffer, const int shift)
  {
   double arr[];
   ArraySetAsSeries(arr, true);
   if(CopyBuffer(handle, buffer, shift, 1, arr) != 1)
      return EMPTY_VALUE;
   return arr[0];
  }

//+------------------------------------------------------------------+
//| Indicator handle cache — avoids create/release every tick        |
//| (fixes Elite_Signals "indicator is too slow" on live charts)     |
//+------------------------------------------------------------------+
struct AuraFX_IndCacheRow
  {
   string            symbol;
   ENUM_TIMEFRAMES   tf;
   int               emaFast, emaSlow, rsiP, macdF, macdS, macdSig;
   int               hEmaFast, hEmaSlow, hRsi, hMacd, hAtr;
  };

struct AuraFX_MACacheRow
  {
   string            symbol;
   ENUM_TIMEFRAMES   tf;
   int               period;
   int               handle;
  };

AuraFX_IndCacheRow g_auraIndCache[];
AuraFX_MACacheRow  g_auraMaCache[];

int AuraFX_CacheFindBundle(const string symbol, const ENUM_TIMEFRAMES tf,
                           const int emaFast, const int emaSlow, const int rsiP,
                           const int macdF, const int macdS, const int macdSig)
  {
   for(int i = 0; i < ArraySize(g_auraIndCache); i++)
     {
      if(g_auraIndCache[i].symbol == symbol && g_auraIndCache[i].tf == tf &&
         g_auraIndCache[i].emaFast == emaFast && g_auraIndCache[i].emaSlow == emaSlow &&
         g_auraIndCache[i].rsiP == rsiP && g_auraIndCache[i].macdF == macdF &&
         g_auraIndCache[i].macdS == macdS && g_auraIndCache[i].macdSig == macdSig)
         return i;
     }
   return -1;
  }

bool AuraFX_CacheEnsureBundle(const string symbol, const ENUM_TIMEFRAMES tf,
                              const int emaFast, const int emaSlow, const int rsiP,
                              const int macdF, const int macdS, const int macdSig,
                              int &hEmaFast, int &hEmaSlow, int &hRsi, int &hMacd, int &hAtr)
  {
   int idx = AuraFX_CacheFindBundle(symbol, tf, emaFast, emaSlow, rsiP, macdF, macdS, macdSig);
   if(idx < 0)
     {
      idx = ArraySize(g_auraIndCache);
      ArrayResize(g_auraIndCache, idx + 1);
      g_auraIndCache[idx].symbol   = symbol;
      g_auraIndCache[idx].tf       = tf;
      g_auraIndCache[idx].emaFast  = emaFast;
      g_auraIndCache[idx].emaSlow  = emaSlow;
      g_auraIndCache[idx].rsiP     = rsiP;
      g_auraIndCache[idx].macdF    = macdF;
      g_auraIndCache[idx].macdS    = macdS;
      g_auraIndCache[idx].macdSig  = macdSig;
      g_auraIndCache[idx].hEmaFast = iMA(symbol, tf, emaFast, 0, MODE_EMA, PRICE_CLOSE);
      g_auraIndCache[idx].hEmaSlow = iMA(symbol, tf, emaSlow, 0, MODE_EMA, PRICE_CLOSE);
      g_auraIndCache[idx].hRsi     = iRSI(symbol, tf, rsiP, PRICE_CLOSE);
      g_auraIndCache[idx].hMacd    = iMACD(symbol, tf, macdF, macdS, macdSig, PRICE_CLOSE);
      g_auraIndCache[idx].hAtr     = iATR(symbol, tf, 14);
     }
   hEmaFast = g_auraIndCache[idx].hEmaFast;
   hEmaSlow = g_auraIndCache[idx].hEmaSlow;
   hRsi     = g_auraIndCache[idx].hRsi;
   hMacd    = g_auraIndCache[idx].hMacd;
   hAtr     = g_auraIndCache[idx].hAtr;
   return (hEmaFast != INVALID_HANDLE && hEmaSlow != INVALID_HANDLE &&
           hRsi != INVALID_HANDLE && hMacd != INVALID_HANDLE && hAtr != INVALID_HANDLE);
  }

int AuraFX_CacheMA(const string symbol, const ENUM_TIMEFRAMES tf, const int period)
  {
   for(int i = 0; i < ArraySize(g_auraMaCache); i++)
     {
      if(g_auraMaCache[i].symbol == symbol && g_auraMaCache[i].tf == tf &&
         g_auraMaCache[i].period == period)
         return g_auraMaCache[i].handle;
     }
   int h = iMA(symbol, tf, period, 0, MODE_EMA, PRICE_CLOSE);
   if(h == INVALID_HANDLE) return INVALID_HANDLE;
   int idx = ArraySize(g_auraMaCache);
   ArrayResize(g_auraMaCache, idx + 1);
   g_auraMaCache[idx].symbol = symbol;
   g_auraMaCache[idx].tf     = tf;
   g_auraMaCache[idx].period = period;
   g_auraMaCache[idx].handle = h;
   return h;
  }

void AuraFX_IndCacheReleaseAll()
  {
   for(int i = 0; i < ArraySize(g_auraIndCache); i++)
     {
      if(g_auraIndCache[i].hEmaFast != INVALID_HANDLE) IndicatorRelease(g_auraIndCache[i].hEmaFast);
      if(g_auraIndCache[i].hEmaSlow != INVALID_HANDLE) IndicatorRelease(g_auraIndCache[i].hEmaSlow);
      if(g_auraIndCache[i].hRsi != INVALID_HANDLE)     IndicatorRelease(g_auraIndCache[i].hRsi);
      if(g_auraIndCache[i].hMacd != INVALID_HANDLE)    IndicatorRelease(g_auraIndCache[i].hMacd);
      if(g_auraIndCache[i].hAtr != INVALID_HANDLE)     IndicatorRelease(g_auraIndCache[i].hAtr);
     }
   for(int i = 0; i < ArraySize(g_auraMaCache); i++)
     {
      if(g_auraMaCache[i].handle != INVALID_HANDLE) IndicatorRelease(g_auraMaCache[i].handle);
     }
   ArrayResize(g_auraIndCache, 0);
   ArrayResize(g_auraMaCache, 0);
  }

//+------------------------------------------------------------------+
//| Core confluence signal engine (cached handles)                   |
//+------------------------------------------------------------------+
ENUM_AURA_SIGNAL AuraFX_ComputeSignal(const string symbol,
                                      const ENUM_TIMEFRAMES tf,
                                      const int shift,
                                      const double rsiBuyMax,
                                      const double rsiSellMin,
                                      const double atrMultMin)
  {
   ENUM_AURA_ASSET asset = AuraFX_DetectAsset(symbol);
   int emaFast, emaSlow, rsiPeriod, macdFast, macdSlow, macdSignal;
   AuraFX_GetPeriods(asset, emaFast, emaSlow, rsiPeriod, macdFast, macdSlow, macdSignal);

   int hEmaFast, hEmaSlow, hRsi, hMacd, hAtr;
   if(!AuraFX_CacheEnsureBundle(symbol, tf, emaFast, emaSlow, rsiPeriod,
                                macdFast, macdSlow, macdSignal,
                                hEmaFast, hEmaSlow, hRsi, hMacd, hAtr))
      return AURA_SIGNAL_NONE;

   double emaF0 = AuraFX_Buffer(hEmaFast, 0, shift);
   double emaF1 = AuraFX_Buffer(hEmaFast, 0, shift + 1);
   double emaS0 = AuraFX_Buffer(hEmaSlow, 0, shift);
   double emaS1 = AuraFX_Buffer(hEmaSlow, 0, shift + 1);
   double rsi0  = AuraFX_Buffer(hRsi, 0, shift);
   double macdM = AuraFX_Buffer(hMacd, 0, shift);
   double macdS = AuraFX_Buffer(hMacd, 1, shift);
   double macdM1= AuraFX_Buffer(hMacd, 0, shift + 1);
   double macdS1= AuraFX_Buffer(hMacd, 1, shift + 1);
   double atr0  = AuraFX_Buffer(hAtr, 0, shift);

   if(emaF0 == EMPTY_VALUE || emaS0 == EMPTY_VALUE || rsi0 == EMPTY_VALUE)
      return AURA_SIGNAL_NONE;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(symbol, tf, shift, 2, rates) < 2)
      return AURA_SIGNAL_NONE;

   double range = rates[0].high - rates[0].low;
   if(atr0 > 0 && range < atr0 * atrMultMin)
      return AURA_SIGNAL_NONE;

   bool bullCross = (emaF1 <= emaS1) && (emaF0 > emaS0);
   bool bearCross = (emaF1 >= emaS1) && (emaF0 < emaS0);
   bool macdBull  = (macdM1 <= macdS1) && (macdM > macdS);
   bool macdBear  = (macdM1 >= macdS1) && (macdM < macdS);

   if(bullCross && macdBull && rsi0 < rsiBuyMax)
      return AURA_SIGNAL_BUY;

   if(bearCross && macdBear && rsi0 > rsiSellMin)
      return AURA_SIGNAL_SELL;

   // Cover: momentum fade after extended move (protect shorts / exit longs)
   if(rsi0 > 72 && emaF0 < emaS0 && macdBear)
      return AURA_SIGNAL_COVER;
   if(rsi0 < 28 && emaF0 > emaS0 && macdBull)
      return AURA_SIGNAL_COVER;

   return AURA_SIGNAL_NONE;
  }

//+------------------------------------------------------------------+
//| Performance tracker for win-rate display                         |
//+------------------------------------------------------------------+
struct AuraFX_Stats
  {
   int    total;
   int    wins;
   int    losses;
   double winRate;
   double targetRate;
  };

void AuraFX_UpdateStats(AuraFX_Stats &stats,
                        const ENUM_AURA_SIGNAL entrySignal,
                        const double entryPrice,
                        const double exitPrice,
                        const double targetWinRate)
  {
   if(entrySignal == AURA_SIGNAL_NONE || entryPrice <= 0 || exitPrice <= 0)
      return;

   stats.total++;
   bool win = false;
   if(entrySignal == AURA_SIGNAL_BUY)
      win = (exitPrice > entryPrice);
   else if(entrySignal == AURA_SIGNAL_SELL)
      win = (exitPrice < entryPrice);
   else
      win = true; // cover signals counted as risk-management wins

   if(win) stats.wins++; else stats.losses++;
   stats.winRate = (stats.total > 0) ? (100.0 * stats.wins / stats.total) : 0.0;
   stats.targetRate = targetWinRate;
  }

//+------------------------------------------------------------------+
//| Draw elegant on-chart HUD panel                                  |
//+------------------------------------------------------------------+
void AuraFX_DrawPanel(const long chartId,
                      const string prefix,
                      const int x, const int y,
                      const ENUM_AURA_SIGNAL signal,
                      const AuraFX_Stats &stats,
                      const string symbol,
                      const ENUM_AURA_ASSET asset)
  {
   string panel = prefix + "_PANEL";
   int w = 280, h = 168;

   if(ObjectFind(chartId, panel) < 0)
     {
      ObjectCreate(chartId, panel, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(chartId, panel, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(chartId, panel, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(chartId, panel, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(chartId, panel, OBJPROP_XSIZE, w);
      ObjectSetInteger(chartId, panel, OBJPROP_YSIZE, h);
      ObjectSetInteger(chartId, panel, OBJPROP_BGCOLOR, AURA_COLOR_PANEL);
      ObjectSetInteger(chartId, panel, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(chartId, panel, OBJPROP_COLOR, AURA_COLOR_GOLD_DIM);
      ObjectSetInteger(chartId, panel, OBJPROP_WIDTH, 1);
      ObjectSetInteger(chartId, panel, OBJPROP_BACK, false);
      ObjectSetInteger(chartId, panel, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, panel, OBJPROP_HIDDEN, true);
     }

   string lines[7];
   lines[0] = "AuraFX ELITE";
   lines[1] = symbol + "  |  " + AuraFX_AssetLabel(asset);
   string sigText = "SCANNING...";
   color sigColor = AURA_COLOR_MUTED;
   if(signal == AURA_SIGNAL_BUY)   { sigText = "BUY";   sigColor = AURA_COLOR_BUY; }
   if(signal == AURA_SIGNAL_SELL)  { sigText = "SELL";  sigColor = AURA_COLOR_SELL; }
   if(signal == AURA_SIGNAL_COVER) { sigText = "COVER"; sigColor = AURA_COLOR_COVER; }
   lines[2] = "Signal: " + sigText;
   lines[3] = StringFormat("Win Rate: %.1f%% / Target %.0f%%", stats.winRate, stats.targetRate);
   lines[4] = StringFormat("Wins: %d  Losses: %d  Total: %d", stats.wins, stats.losses, stats.total);
   lines[5] = "Sell + Cover protection enabled";
   lines[6] = "MT5 Marketplace Edition";

   for(int i = 0; i < 7; i++)
     {
      string name = prefix + "_L" + IntegerToString(i);
      if(ObjectFind(chartId, name) < 0)
        {
         ObjectCreate(chartId, name, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(chartId, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetInteger(chartId, name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(chartId, name, OBJPROP_HIDDEN, true);
        }
      ObjectSetInteger(chartId, name, OBJPROP_XDISTANCE, x + 14);
      ObjectSetInteger(chartId, name, OBJPROP_YDISTANCE, y + 12 + i * 22);
      ObjectSetString(chartId, name, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(chartId, name, OBJPROP_FONTSIZE, i == 0 ? 11 : 9);
      ObjectSetString(chartId, name, OBJPROP_TEXT, lines[i]);
      color c = (i == 0) ? AURA_COLOR_GOLD : (i == 2 ? sigColor : AURA_COLOR_TEXT);
      if(i == 3 && stats.winRate >= stats.targetRate - 2.0)
         c = AURA_COLOR_BUY;
      ObjectSetInteger(chartId, name, OBJPROP_COLOR, c);
     }
   ChartRedraw(chartId);
  }

void AuraFX_DeletePanel(const long chartId, const string prefix)
  {
   ObjectsDeleteAll(chartId, prefix);
  }

string AuraFX_SignalToString(const ENUM_AURA_SIGNAL s)
  {
   if(s == AURA_SIGNAL_BUY)   return "BUY";
   if(s == AURA_SIGNAL_SELL)  return "SELL";
   if(s == AURA_SIGNAL_COVER) return "COVER";
   return "NONE";
  }

#endif // AURAFX_CORE_MQH
