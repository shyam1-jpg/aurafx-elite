//+------------------------------------------------------------------+
//| AuraFX_SmartExit.mqh — lock profit, cut loss, time stop          |
//+------------------------------------------------------------------+
#ifndef AURAFX_SMARTEXIT_MQH
#define AURAFX_SMARTEXIT_MQH

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>

//+------------------------------------------------------------------+
//| Smart exit manager — call every tick from any EA                 |
//+------------------------------------------------------------------+
int AuraFX_SmartManageExits(CTrade &trade,
                            const string symbol,
                            const int magic,
                            const double atr,
                            const ENUM_AURA_SIGNAL liveSig,
                            const bool useBreakeven,
                            const double beStartAtr,
                            const bool useTrail,
                            const double trailStartAtr,
                            const double trailMultAtr,
                            const bool useQuickTP,
                            const double quickTpAtr,
                            const bool useCutLoss,
                            const double cutLossAtr,
                            const bool exitOnOpposite,
                            const int maxBarsStuck,
                            const ENUM_TIMEFRAMES tf)
  {
   if(atr <= 0) return 0;
   int actions = 0;
   datetime nowBar = iTime(symbol, tf, 0);

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;

      bool isBuy = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY;
      double op = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      double px = isBuy ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
      double profitDist = isBuy ? (px - op) : (op - px);
      double riskDist = MathAbs(op - sl);
      if(riskDist <= 0) riskDist = atr;

      datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
      int barsHeld = 0;
      for(int b = 0; b < 500; b++)
        {
         if(iTime(symbol, tf, b) <= openTime) { barsHeld = b; break; }
        }

      // 1) Take profit quickly when target reached
      if(useQuickTP && profitDist >= atr * quickTpAtr)
        {
         if(trade.PositionClose(t)) actions++;
         continue;
        }

      // 2) Cut loss if too far underwater
      if(useCutLoss && profitDist < 0 && MathAbs(profitDist) >= atr * cutLossAtr)
        {
         if(trade.PositionClose(t)) actions++;
         continue;
        }

      // 3) Opposite signal — exit (profit or loss)
      if(exitOnOpposite)
        {
         if(isBuy && liveSig == AURA_SIGNAL_SELL)
           { if(trade.PositionClose(t)) actions++; continue; }
         if(!isBuy && liveSig == AURA_SIGNAL_BUY)
           { if(trade.PositionClose(t)) actions++; continue; }
        }

      // 4) Time stop — stuck losing trade
      if(maxBarsStuck > 0 && barsHeld >= maxBarsStuck && profitDist <= 0)
        {
         if(trade.PositionClose(t)) actions++;
         continue;
        }

      // 5) Breakeven early
      if(useBreakeven && profitDist >= atr * beStartAtr)
        {
         double be = isBuy ? op + 3 * SymbolInfoDouble(symbol, SYMBOL_POINT)
                           : op - 3 * SymbolInfoDouble(symbol, SYMBOL_POINT);
         if(isBuy && sl < be) trade.PositionModify(t, be, tp);
         if(!isBuy && (sl == 0 || sl > be)) trade.PositionModify(t, be, tp);
        }

      // 6) Trailing — tighter when in good profit
      if(useTrail && profitDist >= atr * trailStartAtr)
        {
         double mult = trailMultAtr;
         if(profitDist >= atr * 1.2) mult = trailMultAtr * 0.65;
         double dist = atr * mult;
         double nsl = isBuy ? px - dist : px + dist;
         if(isBuy && nsl > sl) trade.PositionModify(t, nsl, tp);
         if(!isBuy && (sl == 0 || nsl < sl)) trade.PositionModify(t, nsl, tp);
        }
     }
   return actions;
  }

#endif
