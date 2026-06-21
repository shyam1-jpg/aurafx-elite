//+------------------------------------------------------------------+
//| AuraFX_Risk_Guardian.mq5                                         |
//| Live News & Market Risk Warning — protects trader, no auto-close |
//+------------------------------------------------------------------+
#property copyright   "AuraFX Labs"
#property link        "https://www.mql5.com"
#property version     "1.10"
#property description "Live economic calendar, news-risk alerts, trade protection warnings."
#property description "Warnings only — YOU decide to close, reduce, or move SL."
#property indicator_chart_window
#property indicator_plots 0

#include <Trade\Trade.mqh>
#include <AuraFX_NewsRisk.mqh>

input group "=== Risk Guardian ==="
input int    InpWarnMinutesBefore = 90;     // Warn minutes before high-impact event
input int    InpCalendarHoursAhead = 48;    // Calendar lookahead hours
input int    InpRefreshSeconds     = 60;    // Refresh interval (seconds)
input bool   InpSoundAlerts        = true;   // Sound on HIGH risk
input bool   InpPushAlerts         = true;   // Push notifications
input int    InpMagicFilter        = -1;     // Magic filter (-1 = all positions)
input bool   InpAllowButtonClose   = false;  // Button Close executes (YOU opt-in)
input bool   InpShowDashboard      = true;   // Show risk dashboard
input int    InpPanelX             = 20;      // Panel X from right
input int    InpPanelY             = 30;      // Panel Y from top

input group "=== News API (optional) ==="
input string InpNewsApiUrl         = "http://127.0.0.1:3847/api/risk-summary"; // Local news server
input bool   InpUseNewsApi         = false;   // Merge local news server data

const string RISK_PREFIX = "AURAFX_RISK";

AuraFX_CalendarEvent g_events[];
AuraFX_RiskState     g_risk;
AuraFX_TradeExposure g_exp;
datetime             g_last_refresh = 0;
datetime             g_ignore_until = 0;
bool                 g_warned_news = false;
bool                 g_warned_adverse = false;

//+------------------------------------------------------------------+
int OnInit()
  {
   IndicatorSetString(INDICATOR_SHORTNAME, "AuraFX Risk Guardian");
   EventSetTimer(InpRefreshSeconds);
   g_risk.disclaimer = AURA_DISCLAIMER;
   RefreshRiskState();
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   AuraFX_DeleteRiskDashboard(ChartID(), RISK_PREFIX);
  }

//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
  {
   if(TimeCurrent() - g_last_refresh >= InpRefreshSeconds)
      RefreshRiskState();
   return rates_total;
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   RefreshRiskState();
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   AuraFX_GetTradeExposure(_Symbol, InpMagicFilter, g_exp, 0.45);
   if(g_exp.adverse_move && TimeCurrent() > g_ignore_until)
      CheckAdverseWarning();
  }

//+------------------------------------------------------------------+
void RefreshRiskState()
  {
   g_last_refresh = TimeCurrent();
   ZeroMemory(g_risk);
   g_risk.disclaimer = AURA_DISCLAIMER;
   g_risk.session_risk = AURA_RISK_LOW;

   string cur = SymbolInfoString(_Symbol, SYMBOL_CURRENCY_BASE);
   AuraFX_LoadCalendarEvents(g_events, 80, InpCalendarHoursAhead, "");
   g_risk.high_impact_today = AuraFX_CountHighImpactToday(g_events);

   AuraFX_CalendarEvent next;
   g_risk.news_imminent = AuraFX_FindNextHighImpact(g_events, next, InpWarnMinutesBefore);
   if(g_risk.news_imminent)
     {
      g_risk.next_event = next;
      g_risk.session_risk = next.risk;
     }

   AuraFX_GetTradeExposure(_Symbol, InpMagicFilter, g_exp, 0.45);
   g_risk.trade_at_risk = (g_exp.has_position && (g_risk.news_imminent || g_exp.adverse_move));
   g_risk.mood = AuraFX_ComputeMood(g_risk);
   g_risk.ai_explanation = AuraFX_BuildAIExplanation(g_risk, g_exp, _Symbol);

   if(InpShowDashboard)
      AuraFX_DrawRiskDashboard(ChartID(), RISK_PREFIX, InpPanelX, InpPanelY,
                               g_risk, g_exp, _Symbol);

   if(TimeCurrent() > g_ignore_until)
     {
      CheckNewsWarning();
      CheckAdverseWarning();
     }
  }

//+------------------------------------------------------------------+
void CheckNewsWarning()
  {
   if(!g_risk.news_imminent || g_warned_news) return;
   if(!g_exp.has_position && g_risk.next_event.risk < AURA_RISK_HIGH) return;

   string body = "High-impact news coming. Market may become volatile.\n";
   body += g_risk.next_event.name + " in " + IntegerToString(g_risk.next_event.minutes_until) + " min.\n";
   body += "Consider closing, reducing lot size, or moving stop loss.\n";
   body += AuraFX_ImpactText(g_risk.next_event.impact);

   AuraFX_SendRiskAlert("AuraFX RISK GUARDIAN", body, InpSoundAlerts && InpPushAlerts);
   g_warned_news = true;
  }

//+------------------------------------------------------------------+
void CheckAdverseWarning()
  {
   if(!g_exp.adverse_move || g_warned_adverse) return;
   string body = "Trade risk increasing. Possible fund loss. Check position now.\n";
   body += StringFormat("Adverse move ~%.0f points. P/L: %.2f", g_exp.adverse_pips, g_exp.profit);
   AuraFX_SendRiskAlert("AuraFX TRADE WARNING", body, InpSoundAlerts && InpPushAlerts);
   g_warned_adverse = true;
  }

//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
   if(id != CHARTEVENT_OBJECT_CLICK) return;
   ENUM_AURA_WARN_ACTION act = AuraFX_ParseButtonClick(sparam, RISK_PREFIX);
   if(act == AURA_ACTION_NONE) return;

   if(act == AURA_ACTION_IGNORE)
     {
      g_ignore_until = TimeCurrent() + 1800;
      g_warned_news = false;
      g_warned_adverse = false;
      Comment("Risk warning ignored for 30 minutes. " + AURA_DISCLAIMER);
      return;
     }

   if(act == AURA_ACTION_CLOSE && InpAllowButtonClose && g_exp.has_position)
     {
      CTrade t;
      t.PositionClose((ulong)g_exp.ticket);
      Comment("Close requested by YOU. " + AURA_DISCLAIMER);
      return;
     }

   string hint = "";
   if(act == AURA_ACTION_CLOSE)
      hint = "To close: enable InpAllowButtonClose OR close manually in Terminal.";
   if(act == AURA_ACTION_REDUCE_LOT)
      hint = "Reduce lot manually: right-click position -> Volume.";
   if(act == AURA_ACTION_MOVE_SL)
      hint = "Move SL manually: drag SL line or modify position.";
   Comment(hint + "\n" + AURA_DISCLAIMER);
  }

//+------------------------------------------------------------------+
