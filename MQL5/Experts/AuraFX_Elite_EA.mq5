//+------------------------------------------------------------------+
//| AuraFX_Elite_EA.mq5                                              |
//| Automated Forex & Gold + News Risk Protection (warn only)      |
//+------------------------------------------------------------------+
#property copyright   "AuraFX Labs"
#property link        "https://www.mql5.com"
#property version     "1.10"
#property description "AuraFX Elite EA with integrated Risk Guardian warnings."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_NewsRisk.mqh>

input group "=== Risk & Lot Sizing ==="
input double InpLots           = 0.10;
input double InpRiskPercent   = 1.0;
input bool   InpAutoLots       = false;
input int    InpSlPoints       = 300;
input int    InpTpPoints       = 600;
input int    InpMagic          = 202605;

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
input bool   InpBlockNewTradesOnNews = false;  // Block NEW entries (not close)
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

   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1,
                                               InpRsiBuyMax, InpRsiSellMin, InpAtrMultMin);
   ENUM_AURA_ASSET asset = AuraFX_DetectAsset(_Symbol);

   if(InpShowPanel)
      AuraFX_DrawPanel(ChartID(), PANEL_PREFIX, 16, 28, sig, g_stats, _Symbol, asset);

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
         OpenTrade(ORDER_TYPE_BUY);
      g_lastTradeBar = barTime;
     }
   else if(sig == AURA_SIGNAL_SELL)
     {
      if(CountPositions(POSITION_TYPE_BUY) > 0)
         CloseAllPositions();
      if(CountPositions(POSITION_TYPE_SELL) == 0)
         OpenTrade(ORDER_TYPE_SELL);
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
double CalcLots()
  {
   if(!InpAutoLots) return InpLots;
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double tickVal = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSz  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickVal <= 0 || tickSz <= 0) return InpLots;
   double riskMoney = balance * InpRiskPercent / 100.0;
   double slPrice = InpSlPoints * _Point;
   double lots = riskMoney / (slPrice / tickSz * tickVal);
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   lots = MathFloor(lots / step) * step;
   return MathMax(minLot, MathMin(maxLot, lots));
  }

//+------------------------------------------------------------------+
void OpenTrade(const ENUM_ORDER_TYPE type)
  {
   double price = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                           : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = 0, tp = 0;
   if(InpSlPoints > 0)
     {
      if(type == ORDER_TYPE_BUY)  sl = price - InpSlPoints * _Point;
      else                        sl = price + InpSlPoints * _Point;
     }
   if(InpTpPoints > 0)
     {
      if(type == ORDER_TYPE_BUY)  tp = price + InpTpPoints * _Point;
      else                        tp = price - InpTpPoints * _Point;
     }
   trade.PositionOpen(_Symbol, type, CalcLots(), price, sl, tp, "AuraFX Elite");
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
      trade.PositionClose(ticket);
     }
  }

//+------------------------------------------------------------------+
