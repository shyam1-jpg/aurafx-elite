//+------------------------------------------------------------------+
//| AuraFX_Pro.mqh — Professional Trading Assistant Engine           |
//| MTF · Risk · Scoring · Regime · Correlation · Sessions · Gold    |
//+------------------------------------------------------------------+
#ifndef AURAFX_PRO_MQH
#define AURAFX_PRO_MQH

#include <AuraFX_Core.mqh>
#include <AuraFX_NewsRisk.mqh>
#include <AuraFX_Structure.mqh>

enum ENUM_AURA_REGIME
  {
   AURA_REGIME_TRENDING    = 0,
   AURA_REGIME_RANGING     = 1,
   AURA_REGIME_VOLATILE    = 2,
   AURA_REGIME_NEWS_DRIVEN = 3
  };

enum ENUM_AURA_SENTIMENT
  {
   AURA_SENT_STRONG_BULL = 2,
   AURA_SENT_BULL        = 1,
   AURA_SENT_NEUTRAL     = 0,
   AURA_SENT_BEAR        = -1,
   AURA_SENT_STRONG_BEAR = -2
  };

enum ENUM_AURA_SESSION
  {
   AURA_SESSION_ASIAN   = 0,
   AURA_SESSION_LONDON  = 1,
   AURA_SESSION_NEWYORK = 2,
   AURA_SESSION_OVERLAP = 3,
   AURA_SESSION_OFF     = 4
  };

struct AuraFX_SRLevels
  {
   double daily_high, daily_low;
   double weekly_high, weekly_low;
   double monthly_high, monthly_low;
   double supply, demand;
  };

struct AuraFX_Checklist
  {
   bool trend_ok;
   bool sr_ok;
   bool news_ok;
   bool risk_ok;
   bool rr_ok;
   bool volume_ok;
   bool session_ok;
   bool mtf_ok;
   bool structure_ok;
   int  passed;
   int  total;
   bool all_pass;
  };

struct AuraFX_ProScore
  {
   int    total;           // 0-100
   int    trend_strength;
   int    volume_strength;
   int    sr_score;
   int    news_score;
   int    structure_score;
   int    volatility_score;
   double bullish_prob;
   double bearish_prob;
   string grade;           // Excellent / Good / Avoid
   string confidence;
  };

struct AuraFX_ProState
  {
   AuraFX_ProScore       score;
   AuraFX_Checklist      checklist;
   AuraFX_StructureState structure;
   AuraFX_SRLevels       sr;
   ENUM_AURA_REGIME      regime;
   ENUM_AURA_SENTIMENT   sentiment;
   ENUM_AURA_SESSION     session;
   int                   mtf_bull;
   int                   mtf_bear;
   bool                  mtf_agrees_buy;
   bool                  mtf_agrees_sell;
   bool                  news_block_entry;
   bool                  crash_alert;
   bool                  trading_locked;
   string                lock_reason;
   double                suggested_sl;
   double                suggested_tp;
   double                rr_ratio;
   double                smart_lots;
   // Gold
   double                gold_vol_score;
   double                dxy_proxy_bias;
   bool                  gold_overlap;
   // Portfolio
   double                total_exposure_lots;
   int                   correlated_count;
   double                daily_pnl_pct;
   double                weekly_pnl_pct;
  };

#define AURA_PRO_DISCLAIMER "Not financial advice. Assistant tool only. No profit guarantee."

//+------------------------------------------------------------------+
ENUM_AURA_SESSION AuraFX_GetSessionGMT()
  {
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   int h = dt.hour;
   bool asian  = (h >= 0  && h < 9);
   bool london = (h >= 7  && h < 16);
   bool ny     = (h >= 12 && h < 21);
   if(london && ny) return AURA_SESSION_OVERLAP;
   if(ny) return AURA_SESSION_NEWYORK;
   if(london) return AURA_SESSION_LONDON;
   if(asian) return AURA_SESSION_ASIAN;
   return AURA_SESSION_OFF;
  }

string AuraFX_SessionName(const ENUM_AURA_SESSION s)
  {
   if(s == AURA_SESSION_ASIAN)   return "Asian";
   if(s == AURA_SESSION_LONDON)  return "London";
   if(s == AURA_SESSION_NEWYORK)return "New York";
   if(s == AURA_SESSION_OVERLAP) return "London/NY Overlap";
   return "Off-hours";
  }

//+------------------------------------------------------------------+
int AuraFX_TrendOnTF(const string symbol, const ENUM_TIMEFRAMES tf, const int shift = 1)
  {
   int hFast = iMA(symbol, tf, 9, 0, MODE_EMA, PRICE_CLOSE);
   int hSlow = iMA(symbol, tf, 26, 0, MODE_EMA, PRICE_CLOSE);
   double f = AuraFX_Buffer(hFast, 0, shift);
   double s = AuraFX_Buffer(hSlow, 0, shift);
   IndicatorRelease(hFast);
   IndicatorRelease(hSlow);
   if(f == EMPTY_VALUE || s == EMPTY_VALUE) return 0;
   if(f > s) return 1;
   if(f < s) return -1;
   return 0;
  }

//+------------------------------------------------------------------+
void AuraFX_MTFConfirmation(const string symbol, int &bull, int &bear,
                            bool &agree_buy, bool &agree_sell, const int min_agree = 4)
  {
   bull = 0; bear = 0;
   ENUM_TIMEFRAMES tfs[5] = {PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_H1, PERIOD_H4};
   for(int i = 0; i < 5; i++)
     {
      int t = AuraFX_TrendOnTF(symbol, tfs[i], 1);
      if(t > 0) bull++;
      if(t < 0) bear++;
     }
   agree_buy  = (bull >= min_agree);
   agree_sell = (bear >= min_agree);
  }

//+------------------------------------------------------------------+
void AuraFX_LoadSRLevels(const string symbol, AuraFX_SRLevels &sr)
  {
   ZeroMemory(sr);
   MqlRates d[], w[], m[];
   if(CopyRates(symbol, PERIOD_D1, 0, 2, d) >= 2)
     {
      ArraySetAsSeries(d, true);
      sr.daily_high = d[1].high; sr.daily_low = d[1].low;
     }
   if(CopyRates(symbol, PERIOD_W1, 0, 2, w) >= 2)
     {
      ArraySetAsSeries(w, true);
      sr.weekly_high = w[1].high; sr.weekly_low = w[1].low;
     }
   if(CopyRates(symbol, PERIOD_MN1, 0, 2, m) >= 2)
     {
      ArraySetAsSeries(m, true);
      sr.monthly_high = m[1].high; sr.monthly_low = m[1].low;
     }
   AuraFX_StructureState st;
   AuraFX_AnalyzeStructure(symbol, PERIOD_H1, st);
   sr.supply = st.supply_zone;
   sr.demand = st.demand_zone;
  }

//+------------------------------------------------------------------+
ENUM_AURA_REGIME AuraFX_DetectRegime(const string symbol, const ENUM_TIMEFRAMES tf)
  {
   int hAdx = iADX(symbol, tf, 14);
   int hAtr = iATR(symbol, tf, 14);
   double adx = AuraFX_Buffer(hAdx, 0, 1);
   double atr = AuraFX_Buffer(hAtr, 0, 1);
   IndicatorRelease(hAdx);
   IndicatorRelease(hAtr);

   MqlRates r[];
   if(CopyRates(symbol, tf, 1, 20, r) < 20) return AURA_REGIME_RANGING;
   ArraySetAsSeries(r, true);
   double range = r[0].high - r[0].low;
   for(int i = 1; i < 20; i++)
     {
      double rng = r[i].high - r[i].low;
      if(rng > range) range = rng;
     }
   double avg = 0;
   for(int i = 0; i < 20; i++) avg += (r[i].high - r[i].low);
   avg /= 20.0;

   AuraFX_CalendarEvent evs[], next;
   AuraFX_LoadCalendarEvents(evs, 20, 4, "");
   bool news_near = AuraFX_FindNextHighImpact(evs, next, 30);

   if(news_near && next.risk >= AURA_RISK_HIGH) return AURA_REGIME_NEWS_DRIVEN;
   if(atr > 0 && range > atr * 2.2) return AURA_REGIME_VOLATILE;
   if(adx >= 25) return AURA_REGIME_TRENDING;
   return AURA_REGIME_RANGING;
  }

//+------------------------------------------------------------------+
double AuraFX_CalcRiskLot(const string symbol, const double risk_pct,
                          const double entry, const double sl,
                          const double balance)
  {
   if(risk_pct <= 0 || sl <= 0 || entry <= 0) return 0;
   double risk_pct_clamp = MathMax(0.5, MathMin(2.0, risk_pct));
   double risk_money = balance * risk_pct_clamp / 100.0;
   double tick_val = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
   double tick_sz  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   double dist = MathAbs(entry - sl);
   if(tick_sz <= 0 || tick_val <= 0 || dist <= 0) return SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double lots = risk_money / (dist / tick_sz * tick_val);
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   double minl = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxl = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   lots = MathFloor(lots / step) * step;
   return MathMax(minl, MathMin(maxl, lots));
  }

//+------------------------------------------------------------------+
bool AuraFX_CheckLossLimits(const double daily_limit_pct, const double weekly_limit_pct,
                            const double max_dd_pct, double &daily_pnl, double &weekly_pnl,
                            bool &locked, string &reason)
  {
   locked = false;
   reason = "";
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   if(balance <= 0) return true;

   datetime now = TimeCurrent();
   MqlDateTime dt;
   TimeToStruct(now, dt);
   datetime day_start = now - (dt.hour * 3600 + dt.min * 60 + dt.sec);
   int dow = dt.day_of_week;
   datetime week_start = day_start - (datetime)((dow == 0 ? 6 : dow - 1) * 86400);

   HistorySelect(week_start, now);
   double profit_week = 0, profit_day = 0;
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      if(HistoryDealGetInteger(ticket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
      double p = HistoryDealGetDouble(ticket, DEAL_PROFIT) +
                 HistoryDealGetDouble(ticket, DEAL_SWAP) +
                 HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      datetime t = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      profit_week += p;
      if(t >= day_start) profit_day += p;
     }

   daily_pnl = 100.0 * profit_day / balance;
   weekly_pnl = 100.0 * profit_week / balance;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double dd = (balance > 0) ? 100.0 * (balance - equity) / balance : 0;

   if(daily_limit_pct > 0 && daily_pnl <= -daily_limit_pct)
     { locked = true; reason = "Daily loss limit reached"; return false; }
   if(weekly_limit_pct > 0 && weekly_pnl <= -weekly_limit_pct)
     { locked = true; reason = "Weekly loss limit reached"; return false; }
   if(max_dd_pct > 0 && dd >= max_dd_pct)
     { locked = true; reason = "Max drawdown lock"; return false; }
   return true;
  }

//+------------------------------------------------------------------+
bool AuraFX_NewsBlocksEntry(const string symbol, const int block_minutes,
                            AuraFX_CalendarEvent &next_out)
  {
   AuraFX_CalendarEvent evs[];
   AuraFX_LoadCalendarEvents(evs, 40, 24, "");
   if(!AuraFX_FindNextHighImpact(evs, next_out, block_minutes))
      return false;
   return (next_out.risk >= AURA_RISK_MEDIUM);
  }

//+------------------------------------------------------------------+
bool AuraFX_CrashDetector(const string symbol, const ENUM_TIMEFRAMES tf, string &msg)
  {
   int hAtr = iATR(symbol, tf, 14);
   MqlRates r[];
   if(CopyRates(symbol, tf, 0, 3, r) < 3 || hAtr == INVALID_HANDLE)
      return false;
   ArraySetAsSeries(r, true);
   double atr = AuraFX_Buffer(hAtr, 0, 1);
   IndicatorRelease(hAtr);
   double bar = r[1].high - r[1].low;
   double move = MathAbs(r[1].close - r[1].open);
   if(atr > 0 && (bar > atr * 3.5 || move > atr * 2.8))
     {
      msg = "HIGH MARKET RISK — extreme volatility / possible flash move. Consider protecting open positions.";
      return true;
     }
   AuraFX_CalendarEvent evs[], next;
   AuraFX_LoadCalendarEvents(evs, 10, 2, "");
   if(AuraFX_FindNextHighImpact(evs, next, 15) && next.is_breaking_keyword)
     {
      msg = "HIGH MARKET RISK — major breaking event window. CONSIDER PROTECTING OPEN POSITIONS.";
      return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
int AuraFX_CorrelationWarning(const string symbol, const int direction)
  {
   // direction: 1 buy, -1 sell
   string s = symbol;
   StringToUpper(s);
   int warn = 0;
   int eur_trend = AuraFX_TrendOnTF("EURUSD", PERIOD_H1, 1);
   // DXY proxy: USD strength ~ EURUSD down
   if(StringFind(s, "XAU") >= 0 && direction > 0 && eur_trend < 0) warn = 1; // gold buy vs strong USD
   if(StringFind(s, "XAU") >= 0 && direction < 0 && eur_trend > 0) warn = 1;
   if(StringFind(s, "EUR") >= 0 && direction > 0 && eur_trend < 0) warn = 1;
   return warn;
  }

//+------------------------------------------------------------------+
void AuraFX_GoldModule(const string symbol, double &vol_score, double &dxy_bias, bool &overlap)
  {
   vol_score = 0; dxy_bias = 0; overlap = false;
   if(AuraFX_DetectAsset(symbol) != AURA_ASSET_GOLD) return;
   int hAtr = iATR(symbol, PERIOD_H1, 14);
   double atr = AuraFX_Buffer(hAtr, 0, 0);
   IndicatorRelease(hAtr);
   double p = SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(p > 0 && atr > 0) vol_score = MathMin(100, atr / p / 100.0);
   dxy_bias = (double)AuraFX_TrendOnTF("EURUSD", PERIOD_H1, 1) * -1.0; // inverse EUR as DXY proxy
   overlap = (AuraFX_GetSessionGMT() == AURA_SESSION_OVERLAP);
  }

//+------------------------------------------------------------------+
void AuraFX_PortfolioStats(const int magic, double &total_lots, int &corr_count)
  {
   total_lots = 0; corr_count = 0;
   string symbols[];
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!PositionSelectByTicket(PositionGetTicket(i))) continue;
      if(magic >= 0 && PositionGetInteger(POSITION_MAGIC) != magic) continue;
      total_lots += PositionGetDouble(POSITION_VOLUME);
      string sym = PositionGetString(POSITION_SYMBOL);
      bool found = false;
      for(int j = 0; j < n; j++)
         if(symbols[j] == sym) { found = true; break; }
      if(!found)
        {
         ArrayResize(symbols, n + 1);
         symbols[n++] = sym;
        }
     }
   corr_count = (n > 1) ? n - 1 : 0;
  }

//+------------------------------------------------------------------+
void AuraFX_SmartSLTP(const string symbol, const ENUM_ORDER_TYPE type,
                      const AuraFX_SRLevels &sr, const AuraFX_StructureState &st,
                      double &sl, double &tp, double &rr, const double min_rr = 2.0)
  {
   double price = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_ASK)
                                             : SymbolInfoDouble(symbol, SYMBOL_BID);
   int hAtr = iATR(symbol, PERIOD_H1, 14);
   double atr = AuraFX_Buffer(hAtr, 0, 1);
   IndicatorRelease(hAtr);
   if(atr <= 0) atr = 100 * SymbolInfoDouble(symbol, SYMBOL_POINT);

   if(type == ORDER_TYPE_BUY)
     {
      sl = MathMin(st.last_swing_low, sr.daily_low);
      if(sl <= 0 || sl >= price) sl = price - atr * 1.8;
      else sl -= atr * 0.2;
      tp = price + (price - sl) * min_rr;
      if(sr.daily_high > price) tp = MathMax(tp, sr.daily_high);
     }
   else
     {
      sl = MathMax(st.last_swing_high, sr.daily_high);
      if(sl <= price) sl = price + atr * 1.8;
      else sl += atr * 0.2;
      tp = price - (sl - price) * min_rr;
      if(sr.daily_low < price) tp = MathMin(tp, sr.daily_low);
     }
   if(sl > 0 && tp > 0)
      rr = MathAbs(tp - price) / MathAbs(price - sl);
   else
      rr = 0;
  }

//+------------------------------------------------------------------+
void AuraFX_ComputeProScore(const string symbol, const ENUM_AURA_SIGNAL sig,
                            AuraFX_ProState &state,
                            const int news_block_min,
                            const double min_rr)
  {
   ZeroMemory(state.score);
   ZeroMemory(state.checklist);
   state.score.total = 0;

   AuraFX_MTFConfirmation(symbol, state.mtf_bull, state.mtf_bear,
                          state.mtf_agrees_buy, state.mtf_agrees_sell, 4);
   AuraFX_LoadSRLevels(symbol, state.sr);
   AuraFX_AnalyzeStructure(symbol, PERIOD_H1, state.structure);
   state.regime = AuraFX_DetectRegime(symbol, PERIOD_H1);
   state.session = AuraFX_GetSessionGMT();

   AuraFX_CalendarEvent next;
   state.news_block_entry = AuraFX_NewsBlocksEntry(symbol, news_block_min, next);

   int dir = (sig == AURA_SIGNAL_BUY) ? 1 : (sig == AURA_SIGNAL_SELL) ? -1 : 0;

   // Sub-scores 0-100
   state.score.trend_strength = (int)(100.0 * MathMax(state.mtf_bull, state.mtf_bear) / 5.0);
   if(dir > 0 && state.mtf_agrees_buy) state.score.trend_strength = MathMin(100, state.score.trend_strength + 15);
   if(dir < 0 && state.mtf_agrees_sell) state.score.trend_strength = MathMin(100, state.score.trend_strength + 15);

   long vol[];
   if(CopyTickVolume(symbol, PERIOD_H1, 1, 20, vol) >= 20)
     {
      ArraySetAsSeries(vol, true);
      double avg = 0; for(int i = 1; i < 20; i++) avg += (double)vol[i];
      avg /= 19.0;
      state.score.volume_strength = (int)MathMin(100, (vol[0] / MathMax(avg, 1)) * 50.0);
     }

   double price = SymbolInfoDouble(symbol, SYMBOL_BID);
   state.score.sr_score = 50;
   if(dir > 0 && state.sr.demand > 0 && price > state.sr.demand) state.score.sr_score = 80;
   if(dir < 0 && state.sr.supply > 0 && price < state.sr.supply) state.score.sr_score = 80;

   state.score.news_score = state.news_block_entry ? 20 : 85;
   state.score.structure_score = 50;
   if(dir > 0 && state.structure.bias == AURA_STRUCT_BULLISH) state.score.structure_score = 85;
   if(dir < 0 && state.structure.bias == AURA_STRUCT_BEARISH) state.score.structure_score = 85;
   if(state.structure.bullish_fvg && dir > 0) state.score.structure_score += 10;
   if(state.structure.bearish_fvg && dir < 0) state.score.structure_score += 10;

   int hAtr = iATR(symbol, PERIOD_H1, 14);
   double atr = AuraFX_Buffer(hAtr, 0, 0);
   IndicatorRelease(hAtr);
   state.score.volatility_score = (state.regime == AURA_REGIME_VOLATILE) ? 35 : 70;

   state.score.total = (int)(
      state.score.trend_strength * 0.25 +
      state.score.volume_strength * 0.15 +
      state.score.sr_score * 0.15 +
      state.score.news_score * 0.20 +
      state.score.structure_score * 0.15 +
      state.score.volatility_score * 0.10);

   if(state.score.total >= 90) state.score.grade = "Excellent setup";
   else if(state.score.total >= 80) state.score.grade = "Good setup";
   else if(state.score.total >= 70) state.score.grade = "Marginal";
   else state.score.grade = "Avoid";

   double bull_w = (double)state.score.total;
   if(dir < 0) bull_w = 100.0 - bull_w;
   state.score.bullish_prob = (dir >= 0) ? bull_w : (100.0 - state.score.total);
   state.score.bearish_prob = 100.0 - state.score.bullish_prob;
   state.score.confidence = (state.score.total >= 80) ? "High" : (state.score.total >= 70) ? "Medium" : "Low";

   ENUM_ORDER_TYPE otype = (dir > 0) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   AuraFX_SmartSLTP(symbol, otype, state.sr, state.structure,
                    state.suggested_sl, state.suggested_tp, state.rr_ratio, min_rr);

   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   state.smart_lots = AuraFX_CalcRiskLot(symbol, 1.0, price, state.suggested_sl, bal);

   // Checklist
   state.checklist.trend_ok = (dir > 0 && state.mtf_agrees_buy) || (dir < 0 && state.mtf_agrees_sell);
   state.checklist.sr_ok = state.score.sr_score >= 60;
   state.checklist.news_ok = !state.news_block_entry;
   state.checklist.risk_ok = !state.trading_locked;
   state.checklist.rr_ok = (state.rr_ratio >= min_rr);
   state.checklist.volume_ok = state.score.volume_strength >= 45;
   state.checklist.session_ok = (state.session != AURA_SESSION_OFF);
   state.checklist.mtf_ok = state.checklist.trend_ok;
   state.checklist.structure_ok = state.score.structure_score >= 60;

   state.checklist.total = 9;
   state.checklist.passed = 0;
   if(state.checklist.trend_ok) state.checklist.passed++;
   if(state.checklist.sr_ok) state.checklist.passed++;
   if(state.checklist.news_ok) state.checklist.passed++;
   if(state.checklist.risk_ok) state.checklist.passed++;
   if(state.checklist.rr_ok) state.checklist.passed++;
   if(state.checklist.volume_ok) state.checklist.passed++;
   if(state.checklist.session_ok) state.checklist.passed++;
   if(state.checklist.mtf_ok) state.checklist.passed++;
   if(state.checklist.structure_ok) state.checklist.passed++;
   state.checklist.all_pass = (state.checklist.passed >= 8 && state.score.total >= 70);

   AuraFX_GoldModule(symbol, state.gold_vol_score, state.dxy_proxy_bias, state.gold_overlap);
   AuraFX_PortfolioStats(-1, state.total_exposure_lots, state.correlated_count);

   string crash;
   state.crash_alert = AuraFX_CrashDetector(symbol, PERIOD_M15, crash);

   // Sentiment from score + regime
   if(state.score.bullish_prob >= 70) state.sentiment = AURA_SENT_STRONG_BULL;
   else if(state.score.bullish_prob >= 55) state.sentiment = AURA_SENT_BULL;
   else if(state.score.bearish_prob >= 70) state.sentiment = AURA_SENT_STRONG_BEAR;
   else if(state.score.bearish_prob >= 55) state.sentiment = AURA_SENT_BEAR;
   else state.sentiment = AURA_SENT_NEUTRAL;
  }

//+------------------------------------------------------------------+
void AuraFX_DrawProDashboard(const long chartId, const string prefix,
                             const int x, const int y,
                             const AuraFX_ProState &st, const string symbol,
                             const ENUM_AURA_SIGNAL sig)
  {
   string panel = prefix + "_PRO";
   int w = 340, h = 280;
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
   color border = (st.crash_alert) ? AURA_COLOR_RISK_HIGH : AURA_COLOR_GOLD_DIM;
   ObjectSetInteger(chartId, panel, OBJPROP_COLOR, border);
   ObjectSetInteger(chartId, panel, OBJPROP_WIDTH, st.crash_alert ? 2 : 1);

   string sigs = AuraFX_SignalToString(sig);
   string lines[12];
   lines[0] = "AURAFX PRO ASSISTANT";
   lines[1] = StringFormat("Score %d | %s | %s", st.score.total, st.score.grade, st.score.confidence);
   lines[2] = StringFormat("Bull %.0f%%  Bear %.0f%%", st.score.bullish_prob, st.score.bearish_prob);
   lines[3] = StringFormat("MTF %d/%d bull  Signal: %s", st.mtf_bull, st.mtf_bear, sigs);
   string regimeTxt = "Ranging";
   if(st.regime == AURA_REGIME_TRENDING) regimeTxt = "Trending";
   if(st.regime == AURA_REGIME_VOLATILE) regimeTxt = "Volatile";
   if(st.regime == AURA_REGIME_NEWS_DRIVEN) regimeTxt = "News-driven";
   lines[4] = "Regime: " + regimeTxt;
   lines[5] = "Session: " + AuraFX_SessionName(st.session);
   lines[6] = StringFormat("Checklist %d/%d %s", st.checklist.passed, st.checklist.total,
                           st.checklist.all_pass ? "PASS" : "WAIT");
   lines[7] = StringFormat("R:R %.1f  Lots(sug) %.2f", st.rr_ratio, st.smart_lots);
   if(st.news_block_entry)
      lines[8] = "NEWS: No new trades 30m before major event";
   else
      lines[8] = "NEWS: Clear for entry window";
   if(st.trading_locked)
      lines[9] = "LOCK: " + st.lock_reason;
   else
      lines[9] = StringFormat("Exposure %.2f lots | Corr+%d", st.total_exposure_lots, st.correlated_count);
   if(AuraFX_DetectAsset(symbol) == AURA_ASSET_GOLD)
      lines[10] = StringFormat("GOLD vol %.0f | DXY proxy %.1f", st.gold_vol_score, st.dxy_proxy_bias);
   else
      lines[10] = "Structure: " + (st.structure.bos_up ? "BOS up" : st.structure.bos_down ? "BOS down" : "—");
   lines[11] = st.crash_alert ? "!! CRASH / EXTREME RISK !!" : "FVG/OB active";

   for(int i = 0; i < 12; i++)
     {
      string name = prefix + "_P" + IntegerToString(i);
      if(ObjectFind(chartId, name) < 0)
        {
         ObjectCreate(chartId, name, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(chartId, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetInteger(chartId, name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(chartId, name, OBJPROP_HIDDEN, true);
        }
      ObjectSetInteger(chartId, name, OBJPROP_XDISTANCE, x + 12);
      ObjectSetInteger(chartId, name, OBJPROP_YDISTANCE, y + 10 + i * 21);
      ObjectSetString(chartId, name, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(chartId, name, OBJPROP_FONTSIZE, i == 0 ? 10 : 8);
      ObjectSetString(chartId, name, OBJPROP_TEXT, lines[i]);
      color c = AURA_COLOR_TEXT;
      if(i == 0) c = AURA_COLOR_GOLD;
      if(i == 1 && st.score.total >= 90) c = AURA_COLOR_BUY;
      if(i == 1 && st.score.total < 70) c = AURA_COLOR_RISK_HIGH;
      if(i == 6 && !st.checklist.all_pass) c = AURA_COLOR_RISK_MED;
      if(i == 8 && st.news_block_entry) c = AURA_COLOR_RISK_HIGH;
      if(i == 11 && st.crash_alert) c = AURA_COLOR_RISK_HIGH;
      ObjectSetInteger(chartId, name, OBJPROP_COLOR, c);
     }
   ChartRedraw(chartId);
  }

#endif
