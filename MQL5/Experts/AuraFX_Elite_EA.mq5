//+------------------------------------------------------------------+
//| AuraFX_Elite_EA.mq5                                              |
//| Automated Forex & Gold + News Risk Protection (warn only)      |
//+------------------------------------------------------------------+
#property copyright   "AuraFX Labs"
#property link        "https://www.mql5.com"
#property version     "1.31"
#property description "AuraFX Elite EA — signal-candle SL/TP, auto orders, trailing, risk %."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_NewsRisk.mqh>

input group "=== Risk & Lot Sizing ==="
input bool   InpEnableOrderExecution = false; // SAFE DEFAULT: signals only, never place/close orders
input double InpLots           = 0.01;
input double InpRiskPercent   = 1.0;
input bool   InpAutoLots       = true;    // Size lots from account % risk
input int    InpSlPoints       = 200;     // Fixed SL (points) if signal-candle off
input int    InpTpPoints       = 400;     // Fixed TP (points) if signal-candle off
input int    InpMagic          = 202605;

input group "=== Entry Points Pro style SL/TP ==="
input bool   InpUseSignalCandleSL = true;  // SL beyond signal candle high/low
input int    InpSlCandleBufferPts = 10;    // Extra points beyond signal candle
input double InpTpRiskReward      = 2.0;   // TP = risk distance x this ratio
input int    InpMinSlPoints       = 30;    // Minimum SL distance (points)
input int    InpMaxSlPoints       = 800;   // Maximum SL distance (points)

input group "=== Auto exit (profit & protection) ==="
input bool   InpUseTrailing          = true;   // Trail stop when in profit
input int    InpTrailingPoints       = 120;    // Trailing distance (points)
input bool   InpUseBreakeven         = true;   // Move SL to entry after profit
input int    InpBreakevenTriggerPts  = 150;    // Profit needed before breakeven
input int    InpBreakevenLockPts       = 15;     // Lock profit above entry
input double InpMaxDailyLossPct      = 3.0;    // Pause new trades if day loss exceeds %

input group "=== Signal Engine ==="
input double InpTargetWinRate  = 76.0;
input double InpRsiBuyMax      = 62.0;
input double InpRsiSellMin     = 38.0;
input double InpAtrMultMin     = 0.35;
input bool   InpAllowCover     = true;
input bool   InpOneTradePerBar = true;
input bool   InpShowPanel      = true;

input group "=== News Risk Guardian ==="
input bool   InpEnableNewsGuard      = true;   // Enable news/trade warnings
input int    InpWarnMinutesBefore    = 90;     // Minutes before event to warn
input bool   InpBlockNewTradesOnNews = true;   // Block NEW entries before news
input bool   InpSoundRiskAlerts      = true;   // Sound alerts
input bool   InpShowRiskDashboard    = true;   // Risk panel on chart

CTrade trade;
AuraFX_Stats g_stats;
AuraFX_CalendarEvent g_events[];
AuraFX_RiskState g_risk;
AuraFX_TradeExposure g_exp;
datetime g_lastTradeBar = 0;
datetime g_lastRiskCheck = 0;
datetime g_ignore_until = 0;
datetime g_dayStart = 0;
double   g_dayStartBalance = 0;
bool g_warned_news = false;
bool g_warned_adverse = false;
const string PANEL_PREFIX = "AURAFX_EA";
const string RISK_PREFIX = "AURAFX_EA_RISK";

//+------------------------------------------------------------------+
int OnInit()
  {
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(20);
   trade.SetTypeFillingBySymbol(_Symbol);

   g_stats.targetRate = InpTargetWinRate;
   g_stats.total = 0;
   g_stats.wins = 0;
   g_stats.losses = 0;
   g_stats.winRate = 0;
   g_risk.disclaimer = AURA_DISCLAIMER;
   g_dayStart = iTime(_Symbol, PERIOD_D1, 0);
   g_dayStartBalance = AccountInfoDouble(ACCOUNT_BALANCE);

   if(!InpEnableOrderExecution)
      Print("AuraFX Elite: ANALYSIS-ONLY mode. Order execution is disabled.");

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   AuraFX_DeletePanel(ChartID(), PANEL_PREFIX);
   AuraFX_DeleteRiskDashboard(ChartID(), RISK_PREFIX);
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   static datetime lastBar = 0;
   datetime barTime = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(barTime == 0) return;

   bool newBar = (barTime != lastBar);
   if(newBar) lastBar = barTime;

   if(InpEnableNewsGuard)
      RunNewsRiskChecks();

   if(InpEnableOrderExecution)
      ManageOpenPositions();

   if(InpEnableOrderExecution && DailyLossLimitHit())
     {
      Comment("AuraFX: daily loss limit reached — no new trades today. ", AURA_DISCLAIMER);
      return;
     }

   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1,
                                               InpRsiBuyMax, InpRsiSellMin, InpAtrMultMin);
   ENUM_AURA_ASSET asset = AuraFX_DetectAsset(_Symbol);

   if(InpShowPanel)
      AuraFX_DrawPanel(ChartID(), PANEL_PREFIX, 16, 28, sig, g_stats, _Symbol, asset);

   if(!InpEnableOrderExecution)
     {
      Comment("AuraFX ANALYSIS ONLY | Signal: ", AuraFX_SignalToString(sig),
              " | Order execution disabled. ", AURA_DISCLAIMER);
      return;
     }

   if(sig == AURA_SIGNAL_COVER && InpAllowCover)
     {
      CloseAllPositions();
      return;
     }

   if(!newBar && InpOneTradePerBar) return;
   if(g_lastTradeBar == barTime && InpOneTradePerBar) return;

   if(InpEnableNewsGuard && InpBlockNewTradesOnNews && g_risk.news_imminent &&
      g_risk.next_event.risk >= AURA_RISK_HIGH && TimeCurrent() > g_ignore_until)
     {
      Comment("New entries paused: high-impact news in ",
              IntegerToString(g_risk.next_event.minutes_until), " min. ", AURA_DISCLAIMER);
      return;
     }

   if(sig == AURA_SIGNAL_BUY)
     {
      if(CountPositions(POSITION_TYPE_SELL) > 0)
         CloseAllPositions();
      if(CountPositions(POSITION_TYPE_BUY) == 0)
         OpenTrade(ORDER_TYPE_BUY, 1);
      g_lastTradeBar = barTime;
     }
   else if(sig == AURA_SIGNAL_SELL)
     {
      if(CountPositions(POSITION_TYPE_BUY) > 0)
         CloseAllPositions();
      if(CountPositions(POSITION_TYPE_SELL) == 0)
         OpenTrade(ORDER_TYPE_SELL, 1);
      g_lastTradeBar = barTime;
     }
  }

//+------------------------------------------------------------------+
void RunNewsRiskChecks()
  {
   if(TimeCurrent() - g_lastRiskCheck < 30) return;
   g_lastRiskCheck = TimeCurrent();

   ZeroMemory(g_risk);
   AuraFX_LoadCalendarEvents(g_events, 60, 48, "");
   g_risk.high_impact_today = AuraFX_CountHighImpactToday(g_events);
   g_risk.news_imminent = AuraFX_FindNextHighImpact(g_events, g_risk.next_event, InpWarnMinutesBefore);
   if(g_risk.news_imminent)
      g_risk.session_risk = g_risk.next_event.risk;

   AuraFX_GetTradeExposure(_Symbol, InpMagic, g_exp, 0.5);
   g_risk.trade_at_risk = g_exp.has_position && (g_risk.news_imminent || g_exp.adverse_move);
   g_risk.mood = AuraFX_ComputeMood(g_risk);
   g_risk.ai_explanation = AuraFX_BuildAIExplanation(g_risk, g_exp, _Symbol);

   if(InpShowRiskDashboard)
      AuraFX_DrawRiskDashboard(ChartID(), RISK_PREFIX, 20, 200, g_risk, g_exp, _Symbol);

   if(TimeCurrent() <= g_ignore_until) return;

   if(g_risk.news_imminent && g_exp.has_position && !g_warned_news)
     {
      string body = "High-impact news coming. Market may become volatile.\n";
      body += "Consider closing, reducing lot, or moving stop loss.\n";
      body += g_risk.next_event.name;
      if(InpSoundRiskAlerts)
         AuraFX_SendRiskAlert("AuraFX EA — NEWS WARNING", body, true);
      g_warned_news = true;
     }

   if(g_exp.adverse_move && !g_warned_adverse)
     {
      string body = "Trade risk increasing. Possible fund loss. Check position now.";
      if(InpSoundRiskAlerts)
         AuraFX_SendRiskAlert("AuraFX EA — TRADE WARNING", body, true);
      g_warned_adverse = true;
     }
  }

//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
   if(!InpEnableNewsGuard || id != CHARTEVENT_OBJECT_CLICK) return;
   if(AuraFX_ParseButtonClick(sparam, RISK_PREFIX) == AURA_ACTION_IGNORE)
     {
      g_ignore_until = TimeCurrent() + 1800;
      g_warned_news = false;
      g_warned_adverse = false;
     }
  }

//+------------------------------------------------------------------+
double CalcLots(const double slDistancePrice)
  {
   if(!InpAutoLots) return InpLots;
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double tickVal = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSz  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickVal <= 0 || tickSz <= 0) return InpLots;
   double riskMoney = balance * InpRiskPercent / 100.0;
   double slPrice = (slDistancePrice > 0) ? slDistancePrice : InpSlPoints * _Point;
   if(slPrice <= 0) return InpLots;
   double lots = riskMoney / (slPrice / tickSz * tickVal);
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   lots = MathFloor(lots / step) * step;
   return MathMax(minLot, MathMin(maxLot, lots));
  }

//+------------------------------------------------------------------+
bool CalcSignalCandleSLTP(const ENUM_ORDER_TYPE type,
                          const double price,
                          const int signalShift,
                          double &sl,
                          double &tp)
  {
   sl = 0;
   tp = 0;
   double candleHigh = iHigh(_Symbol, PERIOD_CURRENT, signalShift);
   double candleLow  = iLow(_Symbol, PERIOD_CURRENT, signalShift);
   if(candleHigh <= 0 || candleLow <= 0 || candleHigh < candleLow)
      return false;

   if(type == ORDER_TYPE_BUY)
      sl = candleLow - InpSlCandleBufferPts * _Point;
   else
      sl = candleHigh + InpSlCandleBufferPts * _Point;

   double slDist = MathAbs(price - sl);
   double minDist = InpMinSlPoints * _Point;
   double maxDist = InpMaxSlPoints * _Point;
   if(slDist < minDist)
     {
      if(type == ORDER_TYPE_BUY) sl = price - minDist;
      else                      sl = price + minDist;
      slDist = minDist;
     }
   else if(slDist > maxDist)
     {
      if(type == ORDER_TYPE_BUY) sl = price - maxDist;
      else                      sl = price + maxDist;
      slDist = maxDist;
     }

   if(InpTpRiskReward > 0)
     {
      if(type == ORDER_TYPE_BUY) tp = price + slDist * InpTpRiskReward;
      else                       tp = price - slDist * InpTpRiskReward;
     }

   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);
   return true;
  }

//+------------------------------------------------------------------+
bool CalcFixedSLTP(const ENUM_ORDER_TYPE type, const double price, double &sl, double &tp)
  {
   sl = 0;
   tp = 0;
   if(InpSlPoints > 0)
     {
      if(type == ORDER_TYPE_BUY) sl = price - InpSlPoints * _Point;
      else                       sl = price + InpSlPoints * _Point;
     }
   if(InpTpPoints > 0)
     {
      if(type == ORDER_TYPE_BUY) tp = price + InpTpPoints * _Point;
      else                       tp = price - InpTpPoints * _Point;
     }
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   if(sl > 0) sl = NormalizeDouble(sl, digits);
   if(tp > 0) tp = NormalizeDouble(tp, digits);
   return true;
  }

//+------------------------------------------------------------------+
bool EnforceBrokerStops(const ENUM_ORDER_TYPE type,
                        const double price,
                        double &sl,
                        double &tp)
  {
   int stopsLevel = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   if(stopsLevel <= 0) return true;
   double minDist = stopsLevel * _Point;
   if(sl > 0 && MathAbs(price - sl) < minDist)
     {
      if(type == ORDER_TYPE_BUY) sl = price - minDist;
      else                       sl = price + minDist;
     }
   if(tp > 0 && MathAbs(price - tp) < minDist)
     {
      if(type == ORDER_TYPE_BUY) tp = price + minDist;
      else                       tp = price - minDist;
     }
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   if(sl > 0) sl = NormalizeDouble(sl, digits);
   if(tp > 0) tp = NormalizeDouble(tp, digits);
   return true;
  }

//+------------------------------------------------------------------+
void OpenTrade(const ENUM_ORDER_TYPE type, const int signalShift)
  {
   double price = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                           : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = 0, tp = 0;
   if(InpUseSignalCandleSL)
     {
      if(!CalcSignalCandleSLTP(type, price, signalShift, sl, tp))
         CalcFixedSLTP(type, price, sl, tp);
     }
   else
      CalcFixedSLTP(type, price, sl, tp);

   EnforceBrokerStops(type, price, sl, tp);
   double slDist = (sl > 0) ? MathAbs(price - sl) : InpSlPoints * _Point;
   if(!trade.PositionOpen(_Symbol, type, CalcLots(slDist), price, sl, tp, "AuraFX Elite"))
      Print("AuraFX PositionOpen failed: ", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
  }

//+------------------------------------------------------------------+
bool DailyLossLimitHit()
  {
   if(InpMaxDailyLossPct <= 0) return false;
   datetime today = iTime(_Symbol, PERIOD_D1, 0);
   if(today != g_dayStart)
     {
      g_dayStart = today;
      g_dayStartBalance = AccountInfoDouble(ACCOUNT_BALANCE);
     }
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   if(g_dayStartBalance <= 0) return false;
   double lossPct = (g_dayStartBalance - bal) / g_dayStartBalance * 100.0;
   return (lossPct >= InpMaxDailyLossPct);
  }

//+------------------------------------------------------------------+
void ManageOpenPositions()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;

      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      ENUM_POSITION_TYPE ptype = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

      if(ptype == POSITION_TYPE_BUY)
        {
         double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         double profitPts = (bid - openPrice) / _Point;

         if(InpUseBreakeven && profitPts >= InpBreakevenTriggerPts)
           {
            double beSL = openPrice + InpBreakevenLockPts * _Point;
            if(currentSL < beSL - _Point)
               if(!trade.PositionModify(ticket, beSL, currentTP))
                  Print("AuraFX breakeven modify failed: ", trade.ResultRetcodeDescription());
           }

         if(InpUseTrailing && profitPts >= InpTrailingPoints)
           {
            double trailSL = bid - InpTrailingPoints * _Point;
            if(trailSL > currentSL + _Point)
               if(!trade.PositionModify(ticket, trailSL, currentTP))
                  Print("AuraFX trailing modify failed: ", trade.ResultRetcodeDescription());
           }
        }
      else if(ptype == POSITION_TYPE_SELL)
        {
         double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double profitPts = (openPrice - ask) / _Point;

         if(InpUseBreakeven && profitPts >= InpBreakevenTriggerPts)
           {
            double beSL = openPrice - InpBreakevenLockPts * _Point;
            if(currentSL == 0.0 || currentSL > beSL + _Point)
               if(!trade.PositionModify(ticket, beSL, currentTP))
                  Print("AuraFX breakeven modify failed: ", trade.ResultRetcodeDescription());
           }

         if(InpUseTrailing && profitPts >= InpTrailingPoints)
           {
            double trailSL = ask + InpTrailingPoints * _Point;
            if(currentSL == 0.0 || trailSL < currentSL - _Point)
               if(!trade.PositionModify(ticket, trailSL, currentTP))
                  Print("AuraFX trailing modify failed: ", trade.ResultRetcodeDescription());
           }
        }
     }
  }

//+------------------------------------------------------------------+
int CountPositions(const ENUM_POSITION_TYPE ptype)
  {
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!PositionSelectByTicket(PositionGetTicket(i))) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == ptype)
         n++;
     }
   return n;
  }

//+------------------------------------------------------------------+
void CloseAllPositions()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if(!trade.PositionClose(ticket))
         Print("AuraFX PositionClose failed: ", trade.ResultRetcodeDescription());
     }
  }

//+------------------------------------------------------------------+
