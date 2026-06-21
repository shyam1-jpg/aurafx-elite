//+------------------------------------------------------------------+
//| AuraFX_Structure.mqh — SMC: FVG, OB, BOS, CHOCH, Liquidity       |
//+------------------------------------------------------------------+
#ifndef AURAFX_STRUCTURE_MQH
#define AURAFX_STRUCTURE_MQH

enum ENUM_AURA_STRUCTURE_BIAS
  {
   AURA_STRUCT_NEUTRAL = 0,
   AURA_STRUCT_BULLISH = 1,
   AURA_STRUCT_BEARISH = -1
  };

struct AuraFX_StructureState
  {
   ENUM_AURA_STRUCTURE_BIAS bias;
   bool     bullish_fvg;
   bool     bearish_fvg;
   bool     bullish_ob;
   bool     bearish_ob;
   bool     bos_up;
   bool     bos_down;
   bool     choch_bull;
   bool     choch_bear;
   bool     stop_hunt_low;
   bool     stop_hunt_high;
   double   last_swing_high;
   double   last_swing_low;
   double   demand_zone;
   double   supply_zone;
  };

//+------------------------------------------------------------------+
bool AuraFX_FindSwings(const string symbol, const ENUM_TIMEFRAMES tf,
                       const int left, const int right,
                       double &swing_high, double &swing_low)
  {
   MqlRates r[];
   int need = left + right + 5;
   if(CopyRates(symbol, tf, 0, need, r) < need) return false;
   ArraySetAsSeries(r, true);
   swing_high = r[right].high;
   swing_low  = r[right].low;
   for(int i = right; i < need - left - 1; i++)
     {
      bool is_high = true, is_low = true;
      for(int j = 1; j <= left; j++)
        {
         if(r[i].high <= r[i-j].high || r[i].high <= r[i+j].high) is_high = false;
         if(r[i].low  >= r[i-j].low  || r[i].low  >= r[i+j].low)  is_low  = false;
        }
      if(is_high && r[i].high > swing_high) swing_high = r[i].high;
      if(is_low  && r[i].low  < swing_low)  swing_low  = r[i].low;
     }
   return true;
  }

//+------------------------------------------------------------------+
void AuraFX_AnalyzeStructure(const string symbol, const ENUM_TIMEFRAMES tf,
                             AuraFX_StructureState &st, const int lookback = 80)
  {
   ZeroMemory(st);
   st.bias = AURA_STRUCT_NEUTRAL;

   MqlRates r[];
   if(CopyRates(symbol, tf, 0, lookback, r) < 20) return;
   ArraySetAsSeries(r, true);

   AuraFX_FindSwings(symbol, tf, 3, 3, st.last_swing_high, st.last_swing_low);
   double close0 = r[1].close;
   double close1 = r[2].close;

   if(close0 > st.last_swing_high && close1 <= st.last_swing_high)
      st.bos_up = true;
   if(close0 < st.last_swing_low && close1 >= st.last_swing_low)
      st.bos_down = true;

   if(st.bos_up) st.bias = AURA_STRUCT_BULLISH;
   if(st.bos_down) st.bias = AURA_STRUCT_BEARISH;

   // CHOCH: break opposite after prior bias
   if(close0 > st.last_swing_high && r[5].close < st.last_swing_low)
      st.choch_bull = true;
   if(close0 < st.last_swing_low && r[5].close > st.last_swing_high)
      st.choch_bear = true;

   // Bullish FVG: candle[i+1].high < candle[i-1].low
   if(r[3].high < r[1].low)
      st.bullish_fvg = true;
   if(r[3].low > r[1].high)
      st.bearish_fvg = true;

   // Order block: last bearish before bullish displacement
   if(r[2].close < r[2].open && r[1].close > r[1].open && r[1].close - r[1].open > (r[2].open - r[2].close) * 1.2)
     {
      st.bullish_ob = true;
      st.demand_zone = r[2].low;
     }
   if(r[2].close > r[2].open && r[1].close < r[1].open && r[1].open - r[1].close > (r[2].close - r[2].open) * 1.2)
     {
      st.bearish_ob = true;
      st.supply_zone = r[2].high;
     }

   // Stop hunt: wick through swing then close back
   if(r[1].low < st.last_swing_low && r[1].close > st.last_swing_low)
      st.stop_hunt_low = true;
   if(r[1].high > st.last_swing_high && r[1].close < st.last_swing_high)
      st.stop_hunt_high = true;
  }

#endif
