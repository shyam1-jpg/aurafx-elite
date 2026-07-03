//+------------------------------------------------------------------+
//| AuraFX_Liquidity.mqh — BSL/SSL, equilibrium, premium/discount    |
//| Nexorion-style institutional liquidity mapping (original logic)   |
//+------------------------------------------------------------------+
#ifndef AURAFX_LIQUIDITY_MQH
#define AURAFX_LIQUIDITY_MQH

#include <AuraFX_Core.mqh>
#include <AuraFX_Structure.mqh>

enum ENUM_AURA_MARKET_PHASE
  {
   AURA_PHASE_ACCUMULATION = 0,
   AURA_PHASE_MARKUP       = 1,
   AURA_PHASE_DISTRIBUTION = 2,
   AURA_PHASE_MARKDOWN     = 3,
   AURA_PHASE_UNKNOWN      = 4
  };

enum ENUM_AURA_PRICE_ZONE
  {
   AURA_ZONE_DISCOUNT = 0,
   AURA_ZONE_EQUILIBRIUM = 1,
   AURA_ZONE_PREMIUM  = 2
  };

struct AuraFX_LiquidityMap
  {
   double   equilibrium;
   double   bsl_level;      // Buy-side liquidity (equal highs)
   double   ssl_level;      // Sell-side liquidity (equal lows)
   double   range_high;
   double   range_low;
   double   premium_top;
   double   discount_bottom;
   ENUM_AURA_PRICE_ZONE zone;
   ENUM_AURA_MARKET_PHASE phase;
   bool     bsl_swept;
   bool     ssl_swept;
   bool     scan_ok;
   string   phase_name;
  };

//+------------------------------------------------------------------+
ENUM_AURA_MARKET_PHASE AuraFX_DetectPhase(const string symbol, const ENUM_TIMEFRAMES tf)
  {
   int hAdx = iADX(symbol, tf, 14);
   int hMa  = iMA(symbol, tf, 50, 0, MODE_EMA, PRICE_CLOSE);
   double adx[], ma[], close[];
   ArraySetAsSeries(adx, true); ArraySetAsSeries(ma, true); ArraySetAsSeries(close, true);
   if(CopyBuffer(hAdx, 0, 1, 3, adx) < 3 || CopyBuffer(hMa, 0, 1, 3, ma) < 3 ||
      CopyClose(symbol, tf, 1, 3, close) < 3)
     { IndicatorRelease(hAdx); IndicatorRelease(hMa); return AURA_PHASE_UNKNOWN; }
   IndicatorRelease(hAdx); IndicatorRelease(hMa);

   bool trending = adx[0] >= 22;
   bool rising   = close[0] > close[2];
   bool falling  = close[0] < close[2];

   if(!trending) return AURA_PHASE_ACCUMULATION;
   if(rising && close[0] > ma[0]) return AURA_PHASE_MARKUP;
   if(falling && close[0] < ma[0]) return AURA_PHASE_MARKDOWN;
   return AURA_PHASE_DISTRIBUTION;
  }

string AuraFX_PhaseName(const ENUM_AURA_MARKET_PHASE p)
  {
   if(p == AURA_PHASE_MARKUP) return "Markup";
   if(p == AURA_PHASE_MARKDOWN) return "Markdown";
   if(p == AURA_PHASE_DISTRIBUTION) return "Distribution";
   if(p == AURA_PHASE_ACCUMULATION) return "Accumulation";
   return "Scanning";
  }

//+------------------------------------------------------------------+
void AuraFX_ComputeLiquidityMap(const string symbol, const ENUM_TIMEFRAMES tf,
                                AuraFX_LiquidityMap &map, const int lookback = 60)
  {
   ZeroMemory(map);
   map.scan_ok = false;
   map.phase = AuraFX_DetectPhase(symbol, tf);
   map.phase_name = AuraFX_PhaseName(map.phase);

   MqlRates r[];
   if(CopyRates(symbol, tf, 0, lookback, r) < 30) return;
   ArraySetAsSeries(r, true);

   map.range_high = r[1].high;
   map.range_low  = r[1].low;
   for(int i = 1; i < lookback - 1; i++)
     {
      if(r[i].high > map.range_high) map.range_high = r[i].high;
      if(r[i].low  < map.range_low)  map.range_low  = r[i].low;
     }

   map.equilibrium = (map.range_high + map.range_low) * 0.5;
   map.premium_top = map.range_high;
   map.discount_bottom = map.range_low;

   // BSL: recent swing highs cluster (within 0.15% tolerance)
   double tol = map.equilibrium * 0.0015;
   map.bsl_level = map.range_high;
   map.ssl_level = map.range_low;
   int bslHits = 0, sslHits = 0;
   for(int i = 2; i < 25; i++)
     {
      if(MathAbs(r[i].high - map.range_high) <= tol) bslHits++;
      if(MathAbs(r[i].low - map.range_low) <= tol) sslHits++;
     }
   if(bslHits < 2) map.bsl_level = map.range_high;
   if(sslHits < 2) map.ssl_level = map.range_low;

   double px = r[1].close;
   double eqBand = (map.range_high - map.range_low) * 0.08;
   if(px < map.equilibrium - eqBand) map.zone = AURA_ZONE_DISCOUNT;
   else if(px > map.equilibrium + eqBand) map.zone = AURA_ZONE_PREMIUM;
   else map.zone = AURA_ZONE_EQUILIBRIUM;

   map.bsl_swept = (r[1].high > map.bsl_level && r[1].close < map.bsl_level);
   map.ssl_swept = (r[1].low < map.ssl_level && r[1].close > map.ssl_level);
   map.scan_ok = true;
  }

//+------------------------------------------------------------------+
bool AuraFX_NexorionBuyOk(const AuraFX_LiquidityMap &map, const AuraFX_StructureState &st)
  {
   if(!map.scan_ok) return false;
   bool zoneOk = (map.zone == AURA_ZONE_DISCOUNT || map.ssl_swept);
   bool structOk = st.stop_hunt_low || st.bullish_ob || st.bos_up || st.choch_bull;
   bool phaseOk = (map.phase != AURA_PHASE_MARKDOWN && map.phase != AURA_PHASE_DISTRIBUTION);
   return zoneOk && structOk && phaseOk;
  }

bool AuraFX_NexorionSellOk(const AuraFX_LiquidityMap &map, const AuraFX_StructureState &st)
  {
   if(!map.scan_ok) return false;
   bool zoneOk = (map.zone == AURA_ZONE_PREMIUM || map.bsl_swept);
   bool structOk = st.stop_hunt_high || st.bearish_ob || st.bos_down || st.choch_bear;
   bool phaseOk = (map.phase != AURA_PHASE_MARKUP && map.phase != AURA_PHASE_ACCUMULATION);
   return zoneOk && structOk && phaseOk;
  }

//+------------------------------------------------------------------+
void AuraFX_DrawLiquidityZones(const long chartId, const string prefix,
                               const AuraFX_LiquidityMap &map)
  {
   if(!map.scan_ok) return;

   string eqLine = prefix + "_EQ";
   if(ObjectFind(chartId, eqLine) < 0)
     {
      ObjectCreate(chartId, eqLine, OBJ_HLINE, 0, 0, map.equilibrium);
      ObjectSetInteger(chartId, eqLine, OBJPROP_COLOR, C'212,175,55');
      ObjectSetInteger(chartId, eqLine, OBJPROP_STYLE, STYLE_DASH);
      ObjectSetInteger(chartId, eqLine, OBJPROP_WIDTH, 2);
      ObjectSetString(chartId, eqLine, OBJPROP_TEXT, "EQ Equilibrium");
     }
   ObjectSetDouble(chartId, eqLine, OBJPROP_PRICE, map.equilibrium);

   string bsl = prefix + "_BSL";
   if(ObjectFind(chartId, bsl) < 0)
     {
      ObjectCreate(chartId, bsl, OBJ_HLINE, 0, 0, map.bsl_level);
      ObjectSetInteger(chartId, bsl, OBJPROP_COLOR, C'231,76,60');
      ObjectSetInteger(chartId, bsl, OBJPROP_STYLE, STYLE_DOT);
      ObjectSetString(chartId, bsl, OBJPROP_TEXT, "BSL Liquidity");
     }
   ObjectSetDouble(chartId, bsl, OBJPROP_PRICE, map.bsl_level);

   string ssl = prefix + "_SSL";
   if(ObjectFind(chartId, ssl) < 0)
     {
      ObjectCreate(chartId, ssl, OBJ_HLINE, 0, 0, map.ssl_level);
      ObjectSetInteger(chartId, ssl, OBJPROP_COLOR, C'46,204,113');
      ObjectSetInteger(chartId, ssl, OBJPROP_STYLE, STYLE_DOT);
      ObjectSetString(chartId, ssl, OBJPROP_TEXT, "SSL Liquidity");
     }
   ObjectSetDouble(chartId, ssl, OBJPROP_PRICE, map.ssl_level);

   string prem = prefix + "_PREM";
   if(ObjectFind(chartId, prem) < 0)
     {
      ObjectCreate(chartId, prem, OBJ_RECTANGLE, 0, TimeCurrent(), map.premium_top,
                   TimeCurrent() + 86400, map.equilibrium);
      ObjectSetInteger(chartId, prem, OBJPROP_COLOR, C'231,76,60');
      ObjectSetInteger(chartId, prem, OBJPROP_FILL, true);
      ObjectSetInteger(chartId, prem, OBJPROP_BACK, true);
      ObjectSetInteger(chartId, prem, OBJPROP_SELECTABLE, false);
     }
   ObjectSetDouble(chartId, prem, OBJPROP_PRICE, 0, map.premium_top);
   ObjectSetDouble(chartId, prem, OBJPROP_PRICE, 1, map.equilibrium);

   string disc = prefix + "_DISC";
   if(ObjectFind(chartId, disc) < 0)
     {
      ObjectCreate(chartId, disc, OBJ_RECTANGLE, 0, TimeCurrent(), map.equilibrium,
                   TimeCurrent() + 86400, map.discount_bottom);
      ObjectSetInteger(chartId, disc, OBJPROP_COLOR, C'46,204,113');
      ObjectSetInteger(chartId, disc, OBJPROP_FILL, true);
      ObjectSetInteger(chartId, disc, OBJPROP_BACK, true);
      ObjectSetInteger(chartId, disc, OBJPROP_SELECTABLE, false);
     }
   ObjectSetDouble(chartId, disc, OBJPROP_PRICE, 0, map.equilibrium);
   ObjectSetDouble(chartId, disc, OBJPROP_PRICE, 1, map.discount_bottom);
  }

void AuraFX_DeleteLiquidityZones(const long chartId, const string prefix)
  {
   ObjectDelete(chartId, prefix + "_EQ");
   ObjectDelete(chartId, prefix + "_BSL");
   ObjectDelete(chartId, prefix + "_SSL");
   ObjectDelete(chartId, prefix + "_PREM");
   ObjectDelete(chartId, prefix + "_DISC");
  }

#endif
