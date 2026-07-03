//+------------------------------------------------------------------+
//| AuraFX_Elite_Classic_EA.mq5                                      |
//| MT5 port of AuraFX Elite (EMA + RSI + MACD + ATR)                |
//+------------------------------------------------------------------+
#property copyright "AuraFX Elite"
#property version   "1.00"
#property description "EMA trend + RSI(50) cross + MACD cross, ATR SL/TP"

#include <Trade\Trade.mqh>

input group "=== STRATEGY SETTINGS ==="
input int     InpEMA_Fast       = 50;
input int     InpEMA_Slow       = 200;
input int     InpRSI_Period     = 14;
input double  InpRSI_BullLevel  = 50.0;
input double  InpRSI_BearLevel  = 50.0;
input int     InpMACD_Fast      = 12;
input int     InpMACD_Slow      = 26;
input int     InpMACD_Signal    = 9;
input int     InpATR_Period     = 14;
input double  InpATR_SL_Multi   = 1.5;
input double  InpATR_TP_Multi   = 2.5;

input group "=== RISK MANAGEMENT ==="
input double  InpRiskPercent    = 1.0;
input double  InpMaxSpreadPts   = 30.0;
input int     InpMaxOpenTrades  = 1;
input bool    InpUseTrailingStop = true;
input double  InpTrailATRMulti  = 1.0;

input group "=== SESSION FILTER ==="
input bool    InpUseSessionFilter = false;
input int     InpSessionStartHour = 7;
input int     InpSessionEndHour   = 20;

input group "=== EA SETTINGS ==="
input ulong   InpMagicNumber    = 202400;
input string  InpEA_Comment     = "AuraFX Elite Classic";

CTrade trade;
int hEmaFast = INVALID_HANDLE;
int hEmaSlow = INVALID_HANDLE;
int hRsi     = INVALID_HANDLE;
int hMacd    = INVALID_HANDLE;
int hAtr     = INVALID_HANDLE;

//+------------------------------------------------------------------+
int OnInit()
  {
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(20);
   trade.SetTypeFillingBySymbol(_Symbol);

   hEmaFast = iMA(_Symbol, PERIOD_CURRENT, InpEMA_Fast, 0, MODE_EMA, PRICE_CLOSE);
   hEmaSlow = iMA(_Symbol, PERIOD_CURRENT, InpEMA_Slow, 0, MODE_EMA, PRICE_CLOSE);
   hRsi     = iRSI(_Symbol, PERIOD_CURRENT, InpRSI_Period, PRICE_CLOSE);
   hMacd    = iMACD(_Symbol, PERIOD_CURRENT, InpMACD_Fast, InpMACD_Slow, InpMACD_Signal, PRICE_CLOSE);
   hAtr     = iATR(_Symbol, PERIOD_CURRENT, InpATR_Period);

   if(hEmaFast == INVALID_HANDLE || hEmaSlow == INVALID_HANDLE ||
      hRsi == INVALID_HANDLE || hMacd == INVALID_HANDLE || hAtr == INVALID_HANDLE)
     {
      Print("AuraFX Elite Classic: indicator init failed");
      return INIT_FAILED;
     }

   Print("AuraFX Elite Classic initialized on ", _Symbol, " | TF: ", EnumToString(PERIOD_CURRENT));
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(hEmaFast != INVALID_HANDLE) IndicatorRelease(hEmaFast);
   if(hEmaSlow != INVALID_HANDLE) IndicatorRelease(hEmaSlow);
   if(hRsi != INVALID_HANDLE) IndicatorRelease(hRsi);
   if(hMacd != INVALID_HANDLE) IndicatorRelease(hMacd);
   if(hAtr != INVALID_HANDLE) IndicatorRelease(hAtr);
  }

//+------------------------------------------------------------------+
bool Copy1(const int handle, const int buffer, double &out0, double &out1)
  {
   double b[];
   ArraySetAsSeries(b, true);
   if(CopyBuffer(handle, buffer, 1, 2, b) < 2)
      return false;
   out0 = b[0];
   out1 = b[1];
   return true;
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   static datetime lastBar = 0;
   datetime barTime = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(barTime == 0)
      return;

   if(barTime == lastBar)
     {
      if(InpUseTrailingStop)
         ManageTrailingStop();
      return;
     }
   lastBar = barTime;

   if(InpUseSessionFilter && !IsWithinSession())
      return;

   if((double)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) > InpMaxSpreadPts)
     {
      Print("AuraFX Elite Classic: spread too high");
      return;
     }

   double emaFast0, emaFast1, emaSlow0, rsi0, rsi1, macd0, macd1, sig0, sig1, atrVal;
   if(!Copy1(hEmaFast, 0, emaFast0, emaFast1)) return;
   if(!Copy1(hEmaSlow, 0, emaSlow0, emaFast1)) return;
   if(!Copy1(hRsi, 0, rsi0, rsi1)) return;
   if(!Copy1(hMacd, 0, macd0, macd1)) return;
   if(!Copy1(hMacd, 1, sig0, sig1)) return;
   double atrBuf[];
   ArraySetAsSeries(atrBuf, true);
   if(CopyBuffer(hAtr, 0, 1, 1, atrBuf) < 1) return;
   atrVal = atrBuf[0];

   bool trendBull    = (emaFast0 > emaSlow0);
   bool trendBear    = (emaFast0 < emaSlow0);
   bool rsiBullCross = (rsi1 < InpRSI_BullLevel && rsi0 >= InpRSI_BullLevel);
   bool rsiBearCross = (rsi1 > InpRSI_BearLevel && rsi0 <= InpRSI_BearLevel);
   bool macdBull     = (macd1 < sig1 && macd0 >= sig0);
   bool macdBear     = (macd1 > sig1 && macd0 <= sig0);

   bool buySignal  = trendBull && rsiBullCross && macdBull;
   bool sellSignal = trendBear && rsiBearCross && macdBear;

   if(CountOpenTrades() >= InpMaxOpenTrades)
      return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double minStop = (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;

   if(buySignal && !HasOpenPosition(POSITION_TYPE_BUY))
     {
      double sl = ask - atrVal * InpATR_SL_Multi;
      double tp = ask + atrVal * InpATR_TP_Multi;
      if(minStop > 0)
        {
         if(ask - sl < minStop) sl = ask - minStop;
         if(tp - ask < minStop) tp = ask + minStop;
        }
      double lots = CalcLotSize(MathAbs(ask - sl));
      if(!trade.Buy(lots, _Symbol, ask, sl, tp, InpEA_Comment))
         Print("BUY failed: ", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
     }
   else if(sellSignal && !HasOpenPosition(POSITION_TYPE_SELL))
     {
      double sl = bid + atrVal * InpATR_SL_Multi;
      double tp = bid - atrVal * InpATR_TP_Multi;
      if(minStop > 0)
        {
         if(sl - bid < minStop) sl = bid + minStop;
         if(bid - tp < minStop) tp = bid - minStop;
        }
      double lots = CalcLotSize(MathAbs(sl - bid));
      if(!trade.Sell(lots, _Symbol, bid, sl, tp, InpEA_Comment))
         Print("SELL failed: ", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
     }
  }

//+------------------------------------------------------------------+
double CalcLotSize(const double slDistance)
  {
   if(slDistance <= 0)
      return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);

   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskAmt  = balance * InpRiskPercent / 100.0;
   double tickVal  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double minLot   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(tickSize <= 0 || tickVal <= 0)
      return minLot;

   double pipValue = (tickVal / tickSize) * slDistance;
   if(pipValue <= 0)
      return minLot;

   double lots = riskAmt / pipValue;
   lots = MathFloor(lots / lotStep) * lotStep;
   lots = MathMax(minLot, MathMin(maxLot, lots));
   return NormalizeDouble(lots, 2);
  }

//+------------------------------------------------------------------+
void ManageTrailingStop()
  {
   double atrBuf[];
   ArraySetAsSeries(atrBuf, true);
   if(CopyBuffer(hAtr, 0, 1, 1, atrBuf) < 1)
      return;
   double trailDist = atrBuf[0] * InpTrailATRMulti;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!PositionSelectByTicket(PositionGetTicket(i)))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber)
         continue;

      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      ulong ticket = PositionGetInteger(POSITION_TICKET);

      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
        {
         double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         double newSL = bid - trailDist;
         if(newSL > currentSL + _Point)
            trade.PositionModify(ticket, newSL, currentTP);
        }
      else if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL)
        {
         double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double newSL = ask + trailDist;
         if(currentSL == 0.0 || newSL < currentSL - _Point)
            trade.PositionModify(ticket, newSL, currentTP);
        }
     }
  }

//+------------------------------------------------------------------+
int CountOpenTrades()
  {
   int count = 0;
   for(int i = 0; i < PositionsTotal(); i++)
     {
      if(!PositionSelectByTicket(PositionGetTicket(i)))
         continue;
      if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
         PositionGetInteger(POSITION_MAGIC) == (long)InpMagicNumber)
         count++;
     }
   return count;
  }

//+------------------------------------------------------------------+
bool HasOpenPosition(const ENUM_POSITION_TYPE posType)
  {
   for(int i = 0; i < PositionsTotal(); i++)
     {
      if(!PositionSelectByTicket(PositionGetTicket(i)))
         continue;
      if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
         PositionGetInteger(POSITION_MAGIC) == (long)InpMagicNumber &&
         PositionGetInteger(POSITION_TYPE) == posType)
         return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
bool IsWithinSession()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return (dt.hour >= InpSessionStartHour && dt.hour < InpSessionEndHour);
  }
//+------------------------------------------------------------------+
