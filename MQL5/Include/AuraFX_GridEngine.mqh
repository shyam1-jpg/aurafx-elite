//+------------------------------------------------------------------+
//| AuraFX_GridEngine.mqh — Trend-following basket / smart recovery  |
//| No martingale doubling — capped additive lots, basket TP/SL      |
//+------------------------------------------------------------------+
#ifndef AURAFX_GRIDENGINE_MQH
#define AURAFX_GRIDENGINE_MQH

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>

enum ENUM_AURA_GRID_SIDE
  {
   AURA_GRID_NONE = 0,
   AURA_GRID_BUY  = 1,
   AURA_GRID_SELL = -1
  };

struct AuraFX_BasketStats
  {
   ENUM_AURA_GRID_SIDE side;
   int     count;
   double  total_lots;
   double  avg_price;
   double  basket_profit;
   double  basket_profit_pts;
   double  worst_drawdown_pts;
   int     grid_level;
  };

//+------------------------------------------------------------------+
double AuraFX_GridLotScale(const int level, const double baseLot,
                           const double stepMult, const double maxMult)
  {
   if(level <= 0) return baseLot;
   double mult = 1.0 + (level * stepMult);
   mult = MathMin(mult, maxMult);
   double lots = baseLot * mult;
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minl = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxl = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   lots = MathFloor(lots / step) * step;
   return MathMax(minl, MathMin(maxl, lots));
  }

//+------------------------------------------------------------------+
void AuraFX_BasketCollect(const string symbol, const int magic,
                          AuraFX_BasketStats &b)
  {
   b.side = AURA_GRID_NONE;
   b.count = 0;
   b.total_lots = 0;
   b.avg_price = 0;
   b.basket_profit = 0;
   b.basket_profit_pts = 0;
   b.worst_drawdown_pts = 0;
   b.grid_level = 0;

   double sumPxVol = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != magic) continue;

      double vol = PositionGetDouble(POSITION_VOLUME);
      double op  = PositionGetDouble(POSITION_PRICE_OPEN);
      bool isBuy = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY;
      ENUM_AURA_GRID_SIDE ps = isBuy ? AURA_GRID_BUY : AURA_GRID_SELL;

      if(b.count == 0) b.side = ps;
      else if(b.side != ps) continue;

      b.count++;
      b.total_lots += vol;
      sumPxVol += op * vol;
      b.basket_profit += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);

      double px = isBuy ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
      double pts = isBuy ? (px - op) / _Point : (op - px) / _Point;
      if(pts < b.worst_drawdown_pts) b.worst_drawdown_pts = pts;
     }

   if(b.count > 0 && b.total_lots > 0)
     {
      b.avg_price = sumPxVol / b.total_lots;
      b.grid_level = b.count - 1;
      double px = (b.side == AURA_GRID_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID)
                                            : SymbolInfoDouble(symbol, SYMBOL_ASK);
      b.basket_profit_pts = (b.side == AURA_GRID_BUY)
                            ? (px - b.avg_price) / _Point
                            : (b.avg_price - px) / _Point;
     }
  }

//+------------------------------------------------------------------+
bool AuraFX_BasketTpHit(const AuraFX_BasketStats &b, const double tpPts)
  {
   return (b.count > 0 && b.basket_profit_pts >= tpPts);
  }

bool AuraFX_BasketSlHit(const AuraFX_BasketStats &b, const double slPts)
  {
   return (b.count > 0 && b.worst_drawdown_pts <= -slPts);
  }

bool AuraFX_CanAddGrid(const AuraFX_BasketStats &b, const int maxLevels,
                       const double gridStepPts, const ENUM_AURA_GRID_SIDE wantSide)
  {
   if(b.count == 0 || b.side != wantSide) return false;
   if(b.grid_level >= maxLevels - 1) return false;
   if(b.basket_profit_pts >= 0) return false;
   return (MathAbs(b.worst_drawdown_pts) >= gridStepPts * (b.grid_level + 1));
  }

//+------------------------------------------------------------------+
void AuraFX_CloseBasket(CTrade &trade, const string symbol, const int magic)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != magic) continue;
      trade.PositionClose(t);
     }
  }

//+------------------------------------------------------------------+
void AuraFX_DrawGridPanel(const long chartId, const string prefix,
                          const int x, const int y,
                          const AuraFX_BasketStats &b,
                          const string strategyName,
                          const int activeStrategy,
                          const int totalStrategies,
                          const bool spreadOk,
                          const bool locked)
  {
   string panel = prefix + "_GRID";
   int w = 360, h = 200;
   if(ObjectFind(chartId, panel) < 0)
     {
      ObjectCreate(chartId, panel, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(chartId, panel, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(chartId, panel, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, panel, OBJPROP_HIDDEN, true);
     }
   ObjectSetInteger(chartId, panel, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(chartId, panel, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(chartId, panel, OBJPROP_XSIZE, w);
   ObjectSetInteger(chartId, panel, OBJPROP_YSIZE, h);
   ObjectSetInteger(chartId, panel, OBJPROP_BGCOLOR, AURA_COLOR_PANEL);
   ObjectSetInteger(chartId, panel, OBJPROP_COLOR, AURA_COLOR_GOLD_DIM);

   string sideTxt = (b.side == AURA_GRID_BUY) ? "BUY basket" :
                    (b.side == AURA_GRID_SELL) ? "SELL basket" : "Flat";
   string lines[8];
   lines[0] = "AURAFX QUANTUM QUEEN";
   lines[1] = StringFormat("Strategy %d/%d: %s", activeStrategy, totalStrategies, strategyName);
   lines[2] = StringFormat("Basket: %s | Levels %d | Lots %.2f", sideTxt, b.count, b.total_lots);
   lines[3] = StringFormat("Avg %.2f | P/L %.1f pts | $%.2f", b.avg_price, b.basket_profit_pts, b.basket_profit);
   lines[4] = StringFormat("Spread: %s | Grid level %d", spreadOk ? "OK" : "BLOCKED", b.grid_level);
   lines[5] = locked ? "STATUS: Daily lock — no new entries" : "STATUS: Active — monitoring gold";
   lines[6] = "Smart recovery grid — no martingale doubling";
   lines[7] = "Educational software — trading involves risk";

   for(int i = 0; i < 8; i++)
     {
      string lbl = prefix + "_GL" + IntegerToString(i);
      if(ObjectFind(chartId, lbl) < 0)
        {
         ObjectCreate(chartId, lbl, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(chartId, lbl, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetString(chartId, lbl, OBJPROP_FONT, "Segoe UI");
         ObjectSetInteger(chartId, lbl, OBJPROP_FONTSIZE, (i == 0) ? 10 : 9);
         ObjectSetInteger(chartId, lbl, OBJPROP_COLOR, (i == 0) ? AURA_COLOR_GOLD : AURA_COLOR_TEXT);
      }
      ObjectSetInteger(chartId, lbl, OBJPROP_XDISTANCE, x + 14);
      ObjectSetInteger(chartId, lbl, OBJPROP_YDISTANCE, y + 12 + i * 22);
      ObjectSetString(chartId, lbl, OBJPROP_TEXT, lines[i]);
     }
  }

#endif
