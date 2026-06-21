//+------------------------------------------------------------------+
//| AuraFX_Pro_Assistant.mq5                                         |
//| Comprehensive trading assistant — MTF, scoring, SMC, risk, gold  |
//+------------------------------------------------------------------+
#property copyright   "AuraFX Labs"
#property link        "https://www.mql5.com"
#property version     "2.00"
#property description "Pro assistant: MTF, AI score, checklist, BOS/FVG, news block, portfolio."
#property indicator_chart_window
#property indicator_plots 0

#include <AuraFX_Pro.mqh>

input group "=== Pro Assistant ==="
input double InpRiskPct           = 1.0;     // Risk per trade % (0.5-2)
input double InpMinRR             = 2.0;     // Minimum R:R
input int    InpNewsBlockMin      = 30;      // Block new trades X min before news
input int    InpMinMTFAgree       = 4;       // Min timeframes agreeing (of 5)
input int    InpMinScore          = 70;      // Min score to allow signal
input bool   InpRequireChecklist  = true;    // Require checklist pass
input double InpDailyLossLimit    = 3.0;     // Daily loss limit %
input double InpWeeklyLossLimit   = 6.0;     // Weekly loss limit %
input double InpMaxDrawdownLock   = 10.0;    // Max DD lock %
input bool   InpShowProPanel      = true;
input int    InpPanelX            = 16;
input int    InpPanelY            = 200;
input bool   InpAlerts            = true;

const string PRO_PREFIX = "AURAFX_PRO";

AuraFX_ProState g_pro;
datetime g_last_bar = 0;

//+------------------------------------------------------------------+
int OnInit()
  {
   IndicatorSetString(INDICATOR_SHORTNAME, "AuraFX Pro Assistant");
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(ChartID(), PRO_PREFIX);
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
   if(rates_total < 100) return 0;
   ArraySetAsSeries(time, true);
   if(time[0] == g_last_bar) return rates_total;
   g_last_bar = time[0];

   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1, 62, 38, 0.35);

   AuraFX_CheckLossLimits(InpDailyLossLimit, InpWeeklyLossLimit, InpMaxDrawdownLock,
                          g_pro.daily_pnl_pct, g_pro.weekly_pnl_pct,
                          g_pro.trading_locked, g_pro.lock_reason);

   AuraFX_MTFConfirmation(_Symbol, g_pro.mtf_bull, g_pro.mtf_bear,
                          g_pro.mtf_agrees_buy, g_pro.mtf_agrees_sell, InpMinMTFAgree);

   AuraFX_ComputeProScore(_Symbol, sig, g_pro, InpNewsBlockMin, InpMinRR);

   bool allow = true;
   if(sig == AURA_SIGNAL_BUY && !g_pro.mtf_agrees_buy) allow = false;
   if(sig == AURA_SIGNAL_SELL && !g_pro.mtf_agrees_sell) allow = false;
   if(g_pro.score.total < InpMinScore) allow = false;
   if(InpRequireChecklist && !g_pro.checklist.all_pass) allow = false;
   if(g_pro.news_block_entry) allow = false;
   if(g_pro.trading_locked) allow = false;
   if(g_pro.rr_ratio < InpMinRR && sig != AURA_SIGNAL_NONE) allow = false;

   if(InpShowProPanel)
      AuraFX_DrawProDashboard(ChartID(), PRO_PREFIX, InpPanelX, InpPanelY, g_pro, _Symbol, sig);

   if(InpAlerts && g_pro.crash_alert)
      AuraFX_SendRiskAlert("AURAFX CRASH ALERT", "HIGH MARKET RISK — protect open positions.", true);

   if(InpAlerts && g_pro.news_block_entry && sig != AURA_SIGNAL_NONE && !allow)
     {
      string msg = "Do not enter new trades within " + IntegerToString(InpNewsBlockMin) +
                   " minutes of major news.\n" + g_pro.checklist.passed + "/" +
                   IntegerToString(g_pro.checklist.total) + " checklist items.";
      AuraFX_SendRiskAlert("AURAFX PRO — ENTRY BLOCKED", msg, true);
     }

   Comment(
      "AuraFX Pro | Score: ", g_pro.score.total, " | ", g_pro.score.grade, "\n",
      "Bull ", DoubleToString(g_pro.score.bullish_prob, 0), "% / Bear ",
      DoubleToString(g_pro.score.bearish_prob, 0), "%\n",
      "Checklist: ", g_pro.checklist.passed, "/", g_pro.checklist.total,
      (allow ? " | Signal ALLOWED" : " | Signal FILTERED"), "\n",
      AURA_PRO_DISCLAIMER
   );

   return rates_total;
  }

//+------------------------------------------------------------------+
