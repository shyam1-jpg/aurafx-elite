//+------------------------------------------------------------------+
//| AuraFX_MeanReversion.mqh — BB + RSI mean reversion               |
//+------------------------------------------------------------------+
#ifndef AURAFX_MEANREVERSION_MQH
#define AURAFX_MEANREVERSION_MQH

#include <AuraFX_Core.mqh>

bool AuraFX_IsTrending(const string symbol, const ENUM_TIMEFRAMES tf,
                       const int adxPeriod = 14, const double adxMax = 25.0)
  {
   int h = iADX(symbol, tf, adxPeriod);
   if(h == INVALID_HANDLE) return false;
   double adx = AuraFX_Buffer(h, 0, 1);
   IndicatorRelease(h);
   return (adx >= adxMax);
  }

ENUM_AURA_SIGNAL AuraFX_BBRSI_Signal(const string symbol, const ENUM_TIMEFRAMES tf,
                                     const int bbPeriod = 35, const double bbDev = 2.0,
                                     const int rsiPeriod = 15, const double rsiMax = 70.0)
  {
   if(AuraFX_IsTrending(symbol, tf)) return AURA_SIGNAL_NONE;

   int hBb = iBands(symbol, tf, bbPeriod, 0, bbDev, PRICE_CLOSE);
   int hRsi = iRSI(symbol, tf, rsiPeriod, PRICE_CLOSE);
   if(hBb == INVALID_HANDLE || hRsi == INVALID_HANDLE)
     {
      if(hBb != INVALID_HANDLE) IndicatorRelease(hBb);
      if(hRsi != INVALID_HANDLE) IndicatorRelease(hRsi);
      return AURA_SIGNAL_NONE;
     }

   double upper = AuraFX_Buffer(hBb, 1, 1);
   double lower = AuraFX_Buffer(hBb, 2, 1);
   double rsi   = AuraFX_Buffer(hRsi, 0, 1);
   double close = iClose(symbol, tf, 1);
   IndicatorRelease(hBb);
   IndicatorRelease(hRsi);

   if(upper == EMPTY_VALUE || lower == EMPTY_VALUE || rsi == EMPTY_VALUE)
      return AURA_SIGNAL_NONE;

   if(close <= lower && rsi < rsiMax - 10.0) return AURA_SIGNAL_BUY;
   if(close >= upper && rsi > 100.0 - rsiMax) return AURA_SIGNAL_SELL;
   return AURA_SIGNAL_NONE;
  }

#endif