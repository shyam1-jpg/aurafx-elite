//+------------------------------------------------------------------+
//| AuraFX_Engine.mqh — Precision fusion · entry gates · ATR helper  |
//| Uses cached indicators from AuraFX_Core.mqh                      |
//+------------------------------------------------------------------+
#ifndef AURAFX_ENGINE_MQH
#define AURAFX_ENGINE_MQH

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_Structure.mqh>
#include <AuraFX_NewsRisk.mqh>
#include <AuraFX_Pro.mqh>
#include <AuraFX_SmartExit.mqh>

//+------------------------------------------------------------------+
ENUM_AURA_SIGNAL AuraFX_PrecisionFusion(const string symbol, const ENUM_TIMEFRAMES tf,
                                        const double atrMultMin,
                                        const double rsiBuyMax = 62.0,
                                        const double rsiSellMin = 38.0)
  {
   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(symbol, tf, 1, rsiBuyMax, rsiSellMin, atrMultMin);
   AuraFX_StructureState st;
   AuraFX_AnalyzeStructure(symbol, tf, st);

   if(st.bos_up && sig != AURA_SIGNAL_SELL)  sig = AURA_SIGNAL_BUY;
   if(st.bos_down && sig != AURA_SIGNAL_BUY) sig = AURA_SIGNAL_SELL;

   if(tf < PERIOD_H1)
     {
      int htf = AuraFX_TrendOnTF(symbol, PERIOD_H1, 1);
      if(sig == AURA_SIGNAL_BUY && htf < 0)  sig = AURA_SIGNAL_NONE;
      if(sig == AURA_SIGNAL_SELL && htf > 0) sig = AURA_SIGNAL_NONE;
     }
   return sig;
  }

//+------------------------------------------------------------------+
bool AuraFX_SpreadOk(const string symbol, const int maxPts)
  {
   ENUM_AURA_ASSET a = AuraFX_DetectAsset(symbol);
   int limit = maxPts;
   if(a == AURA_ASSET_INDEX) limit = maxPts * 4;
   if(a == AURA_ASSET_GOLD)  limit = (int)(maxPts * 1.5);
   return SymbolInfoInteger(symbol, SYMBOL_SPREAD) <= limit;
  }

bool AuraFX_PrecisionAllowsEntry(const ENUM_AURA_SIGNAL sig, AuraFX_ProState &pro,
                                 const int minScore, const double minRR,
                                 const bool requireChecklist)
  {
   if(sig == AURA_SIGNAL_NONE || sig == AURA_SIGNAL_COVER) return false;
   if(pro.trading_locked || pro.news_block_entry) return false;
   if(pro.score.total < minScore) return false;
   if(pro.rr_ratio < minRR) return false;
   if(requireChecklist && !pro.checklist.all_pass) return false;
   if(sig == AURA_SIGNAL_BUY && !pro.mtf_agrees_buy) return false;
   if(sig == AURA_SIGNAL_SELL && !pro.mtf_agrees_sell) return false;
   return true;
  }

double AuraFX_EngineAtr(const string symbol, const ENUM_TIMEFRAMES tf)
  {
   ENUM_AURA_ASSET asset = AuraFX_DetectAsset(symbol);
   int emaFast, emaSlow, rsiP, macdF, macdS, macdSig;
   AuraFX_GetPeriods(asset, emaFast, emaSlow, rsiP, macdF, macdS, macdSig);
   int hF, hS, hR, hM, hA;
   if(!AuraFX_CacheEnsureBundle(symbol, tf, emaFast, emaSlow, rsiP, macdF, macdS, macdSig,
                                hF, hS, hR, hM, hA))
      return 100 * SymbolInfoDouble(symbol, SYMBOL_POINT);
   double v = AuraFX_Buffer(hA, 0, 0);
   return (v > 0) ? v : 100 * SymbolInfoDouble(symbol, SYMBOL_POINT);
  }

#endif
