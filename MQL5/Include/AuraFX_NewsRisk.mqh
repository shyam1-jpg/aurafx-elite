//+------------------------------------------------------------------+
//| AuraFX_NewsRisk.mqh — Live News & Market Risk Protection         |
//| Warnings only — never auto-closes trades without user action.    |
//+------------------------------------------------------------------+
#property copyright "AuraFX Labs"
#property version   "1.00"

#ifndef AURAFX_NEWSRISK_MQH
#define AURAFX_NEWSRISK_MQH

#include <AuraFX_Core.mqh>

//--- Risk levels
enum ENUM_AURA_RISK_LEVEL
  {
   AURA_RISK_LOW    = 0,
   AURA_RISK_MEDIUM = 1,
   AURA_RISK_HIGH   = 2
  };

//--- Market mood (dashboard)
enum ENUM_AURA_MARKET_MOOD
  {
   AURA_MOOD_SAFE      = 0,
   AURA_MOOD_CAUTION   = 1,
   AURA_MOOD_DANGEROUS = 2
  };

//--- Expected impact tags
enum ENUM_AURA_IMPACT_TAG
  {
   AURA_IMPACT_NEUTRAL       = 0,
   AURA_IMPACT_GOLD_BULLISH  = 1,
   AURA_IMPACT_GOLD_BEARISH  = 2,
   AURA_IMPACT_USD_STRONG    = 3,
   AURA_IMPACT_USD_WEAK      = 4,
   AURA_IMPACT_VOLATILE      = 5
  };

//--- User warning action (logged / optional manual)
enum ENUM_AURA_WARN_ACTION
  {
   AURA_ACTION_NONE        = 0,
   AURA_ACTION_CLOSE       = 1,
   AURA_ACTION_REDUCE_LOT  = 2,
   AURA_ACTION_MOVE_SL     = 3,
   AURA_ACTION_IGNORE      = 4
  };

//--- Calendar event snapshot
struct AuraFX_CalendarEvent
  {
   ulong                 event_id;
   datetime              time_utc;
   string                name;
   string                currency;
   string                country;
   ENUM_AURA_RISK_LEVEL  risk;
   ENUM_AURA_IMPACT_TAG  impact;
   int                   minutes_until;
   bool                  is_breaking_keyword;
  };

//--- Open trade exposure
struct AuraFX_TradeExposure
  {
   bool     has_position;
   long     ticket;
   int      type;           // POSITION_TYPE_BUY/SELL
   double   volume;
   double   entry;
   double   current;
   double   profit;
   double   risk_money;
   double   adverse_pips;
   bool     adverse_move;
  };

//--- Risk state
struct AuraFX_RiskState
  {
   ENUM_AURA_MARKET_MOOD   mood;
   ENUM_AURA_RISK_LEVEL    session_risk;
   AuraFX_CalendarEvent    next_event;
   bool                    news_imminent;
   bool                    trade_at_risk;
   string                  ai_explanation;
   string                  disclaimer;
   int                     high_impact_today;
  };

#define AURA_RISK_PREFIX     "AURAFX_RISK"
#define AURA_COLOR_RISK_HIGH C'192,57,43'
#define AURA_COLOR_RISK_MED  C'230,126,34'
#define AURA_COLOR_RISK_LOW  C'39,174,96'
#define AURA_DISCLAIMER      "Not financial advice. Risk warning tool only. Final decision is yours."

//+------------------------------------------------------------------+
string AuraFX_RiskLevelText(const ENUM_AURA_RISK_LEVEL r)
  {
   if(r == AURA_RISK_HIGH)   return "HIGH RISK";
   if(r == AURA_RISK_MEDIUM) return "MEDIUM RISK";
   return "LOW RISK";
  }

//+------------------------------------------------------------------+
color AuraFX_RiskLevelColor(const ENUM_AURA_RISK_LEVEL r)
  {
   if(r == AURA_RISK_HIGH)   return AURA_COLOR_RISK_HIGH;
   if(r == AURA_RISK_MEDIUM) return AURA_COLOR_RISK_MED;
   return AURA_COLOR_RISK_LOW;
  }

//+------------------------------------------------------------------+
string AuraFX_MoodText(const ENUM_AURA_MARKET_MOOD m)
  {
   if(m == AURA_MOOD_DANGEROUS) return "DANGEROUS";
   if(m == AURA_MOOD_CAUTION)   return "CAUTION";
   return "SAFE";
  }

//+------------------------------------------------------------------+
string AuraFX_ImpactText(const ENUM_AURA_IMPACT_TAG t)
  {
   switch(t)
     {
      case AURA_IMPACT_GOLD_BULLISH: return "Gold bullish bias";
      case AURA_IMPACT_GOLD_BEARISH: return "Gold bearish bias";
      case AURA_IMPACT_USD_STRONG:   return "USD strong bias";
      case AURA_IMPACT_USD_WEAK:     return "USD weak bias";
      case AURA_IMPACT_VOLATILE:     return "High volatility expected";
      default:                       return "Mixed / neutral";
     }
  }

//+------------------------------------------------------------------+
bool AuraFX_NameHasHighImpactKeyword(const string name)
  {
   string n = name;
   StringToUpper(n);
   string keys[] = {"CPI","NFP","NONFARM","FOMC","INTEREST RATE","RATE DECISION",
                    "GDP","PCE","INFLATION","EMPLOYMENT","POWELL","LAGARDE","ECB",
                    "BOE","BOJ","WAR","CONFLICT","CRISIS","DEFAULT","SANCTION",
                    "OIL","FED ","CENTRAL BANK","JOBLESS","RETAIL SALES","PMI"};
   for(int i = 0; i < ArraySize(keys); i++)
      if(StringFind(n, keys[i]) >= 0)
         return true;
   return false;
  }

//+------------------------------------------------------------------+
ENUM_AURA_RISK_LEVEL AuraFX_SeverityToRisk(const ENUM_CALENDAR_EVENT_IMPORTANCE imp,
                                           const string event_name)
  {
   if(AuraFX_NameHasHighImpactKeyword(event_name))
      return AURA_RISK_HIGH;
   if(imp == CALENDAR_IMPORTANCE_HIGH)
      return AURA_RISK_HIGH;
   if(imp == CALENDAR_IMPORTANCE_MODERATE)
      return AURA_RISK_MEDIUM;
   if(imp == CALENDAR_IMPORTANCE_LOW)
      return AURA_RISK_LOW;
   return AURA_RISK_LOW;
  }

//+------------------------------------------------------------------+
ENUM_AURA_IMPACT_TAG AuraFX_GuessImpact(const string event_name, const string currency)
  {
   string n = event_name;
   StringToUpper(n);
   string c = currency;
   StringToUpper(c);

   if(StringFind(n, "WAR") >= 0 || StringFind(n, "CONFLICT") >= 0 || StringFind(n, "CRISIS") >= 0)
      return AURA_IMPACT_VOLATILE;

   if(StringFind(n, "CPI") >= 0 || StringFind(n, "INFLATION") >= 0 || StringFind(n, "PCE") >= 0)
     {
      if(StringFind(n, "HIGH") >= 0 || StringFind(n, "HOT") >= 0)
         return AURA_IMPACT_GOLD_BULLISH;
      return AURA_IMPACT_VOLATILE;
     }

   if(StringFind(n, "NFP") >= 0 || StringFind(n, "EMPLOYMENT") >= 0 || StringFind(n, "JOBLESS") >= 0)
     {
      if(c == "USD") return AURA_IMPACT_USD_STRONG;
      return AURA_IMPACT_VOLATILE;
     }

   if(StringFind(n, "FOMC") >= 0 || StringFind(n, "RATE") >= 0 || StringFind(n, "FED") >= 0)
      return AURA_IMPACT_USD_STRONG;

   if(StringFind(n, "GOLD") >= 0 || StringFind(n, "XAU") >= 0)
      return AURA_IMPACT_GOLD_BULLISH;

   if(StringFind(n, "OIL") >= 0)
      return AURA_IMPACT_VOLATILE;

   if(c == "USD") return AURA_IMPACT_USD_STRONG;
   if(c == "EUR" || c == "GBP") return AURA_IMPACT_VOLATILE;
   return AURA_IMPACT_NEUTRAL;
  }

//+------------------------------------------------------------------+
bool AuraFX_LoadCalendarEvents(AuraFX_CalendarEvent &events[],
                               const int max_events,
                               const int hours_ahead,
                               const string filter_currency = "")
  {
   ArrayResize(events, 0);
   datetime from = TimeGMT();
   datetime to   = from + (datetime)(hours_ahead * 3600);

   MqlCalendarValue values[];
   int total = CalendarValueHistory(values, from, to, NULL,
                                    (filter_currency == "" ? NULL : filter_currency));
   if(total <= 0)
      return false;

   int added = 0;
   for(int i = 0; i < total && added < max_events; i++)
     {
      MqlCalendarEvent ev;
      if(!CalendarEventById(values[i].event_id, ev))
         continue;

      MqlCalendarCountry country;
      string currency = "";
      string country_name = "";
      if(CalendarCountryById(ev.country_id, country))
        {
         currency = country.currency;
         country_name = country.name;
        }

      AuraFX_CalendarEvent item;
      item.event_id = values[i].event_id;
      item.time_utc = values[i].time;
      item.name = ev.name;
      item.currency = currency;
      item.country = country_name;
      item.risk = AuraFX_SeverityToRisk(ev.importance, ev.name);
      item.impact = AuraFX_GuessImpact(ev.name, currency);
      item.minutes_until = (int)((item.time_utc - from) / 60);
      item.is_breaking_keyword = AuraFX_NameHasHighImpactKeyword(ev.name);

      int sz = ArraySize(events);
      ArrayResize(events, sz + 1);
      events[sz] = item;
      added++;
     }

   // Sort by time ascending (simple bubble for small n)
   int n = ArraySize(events);
   for(int a = 0; a < n - 1; a++)
     for(int b = a + 1; b < n; b++)
       if(events[a].time_utc > events[b].time_utc)
         {
          AuraFX_CalendarEvent tmp = events[a];
          events[a] = events[b];
          events[b] = tmp;
         }
   return (n > 0);
  }

//+------------------------------------------------------------------+
bool AuraFX_FindNextHighImpact(AuraFX_CalendarEvent &events[],
                               AuraFX_CalendarEvent &next_out,
                               const int warn_minutes)
  {
   datetime now = TimeGMT();
   bool found = false;
   for(int i = 0; i < ArraySize(events); i++)
     {
      if(events[i].time_utc < now) continue;
      if(events[i].risk < AURA_RISK_MEDIUM && !events[i].is_breaking_keyword) continue;
      int mins = (int)((events[i].time_utc - now) / 60);
      if(mins <= warn_minutes)
        {
         next_out = events[i];
         next_out.minutes_until = mins;
         found = true;
         break;
        }
     }
   return found;
  }

//+------------------------------------------------------------------+
int AuraFX_CountHighImpactToday(AuraFX_CalendarEvent &events[])
  {
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   datetime day_start = StructToTime(dt) - dt.hour * 3600 - dt.min * 60 - dt.sec;
   datetime day_end = day_start + 86400;
   int count = 0;
   for(int i = 0; i < ArraySize(events); i++)
     {
      if(events[i].time_utc < day_start || events[i].time_utc >= day_end) continue;
      if(events[i].risk >= AURA_RISK_MEDIUM || events[i].is_breaking_keyword)
         count++;
     }
   return count;
  }

//+------------------------------------------------------------------+
void AuraFX_GetTradeExposure(const string symbol, const int magic,
                             AuraFX_TradeExposure &exp,
                             const double adverse_atr_mult = 0.5)
  {
   exp.has_position = false;
   exp.adverse_move = false;
   exp.ticket = 0;
   exp.volume = 0;
   exp.entry = 0;
   exp.current = 0;
   exp.profit = 0;
   exp.risk_money = 0;
   exp.adverse_pips = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol) continue;
      if(magic >= 0 && PositionGetInteger(POSITION_MAGIC) != magic) continue;

      exp.has_position = true;
      exp.ticket = (long)ticket;
      exp.type = (int)PositionGetInteger(POSITION_TYPE);
      exp.volume = PositionGetDouble(POSITION_VOLUME);
      exp.entry = PositionGetDouble(POSITION_PRICE_OPEN);
      exp.profit = PositionGetDouble(POSITION_PROFIT);
      exp.current = (exp.type == POSITION_TYPE_BUY) ?
                    SymbolInfoDouble(symbol, SYMBOL_BID) :
                    SymbolInfoDouble(symbol, SYMBOL_ASK);

      double sl = PositionGetDouble(POSITION_SL);
      if(sl > 0)
        {
         double tick_val = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
         double tick_sz  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
         double dist = MathAbs(exp.entry - sl);
         if(tick_sz > 0 && tick_val > 0)
            exp.risk_money = (dist / tick_sz) * tick_val * exp.volume;
        }

      int atr_h = iATR(symbol, PERIOD_CURRENT, 14);
      double atr = AuraFX_Buffer(atr_h, 0, 0);
      IndicatorRelease(atr_h);
      if(atr <= 0) atr = 10 * SymbolInfoDouble(symbol, SYMBOL_POINT);

      if(exp.type == POSITION_TYPE_BUY)
        {
         exp.adverse_pips = (exp.entry - exp.current) / _Point;
         if(exp.current < exp.entry - atr * adverse_atr_mult)
            exp.adverse_move = true;
        }
      else
        {
         exp.adverse_pips = (exp.current - exp.entry) / _Point;
         if(exp.current > exp.entry + atr * adverse_atr_mult)
            exp.adverse_move = true;
        }
      break;
     }
  }

//+------------------------------------------------------------------+
string AuraFX_BuildAIExplanation(const AuraFX_RiskState &st,
                                   const AuraFX_TradeExposure &exp,
                                   const string symbol)
  {
   string text = "";
   if(st.news_imminent)
     {
      text += "What: " + st.next_event.name + " in " + IntegerToString(st.next_event.minutes_until) + " min.\n";
      text += "Why: " + AuraFX_RiskLevelText(st.next_event.risk) + " event can spike spreads and gaps.\n";
      text += "Impact: " + AuraFX_ImpactText(st.next_event.impact) + ".\n";
     }
   if(exp.has_position)
     {
      text += "Your " + symbol + " trade: " + (exp.type == POSITION_TYPE_BUY ? "BUY" : "SELL");
      text += StringFormat(" %.2f lots, P/L %.2f.\n", exp.volume, exp.profit);
      if(exp.adverse_move)
         text += "Price is moving against you — fund loss risk is rising.\n";
      text += "Consider: close, reduce lot, or tighten stop loss before the event.\n";
     }
   else if(st.news_imminent)
      text += "No open position on this symbol — avoid new entries until volatility settles.\n";

   text += AURA_DISCLAIMER;
   return text;
  }

//+------------------------------------------------------------------+
ENUM_AURA_MARKET_MOOD AuraFX_ComputeMood(const AuraFX_RiskState &st)
  {
   if(st.news_imminent && st.next_event.risk == AURA_RISK_HIGH)
      return AURA_MOOD_DANGEROUS;
   if(st.trade_at_risk || st.news_imminent)
      return AURA_MOOD_CAUTION;
   if(st.session_risk == AURA_RISK_HIGH)
      return AURA_MOOD_CAUTION;
   return AURA_MOOD_SAFE;
  }

//+------------------------------------------------------------------+
void AuraFX_SendRiskAlert(const string title, const string body,
                          const bool sound, const string sound_file = "alert2.wav")
  {
   string msg = title + "\n" + body + "\n" + AURA_DISCLAIMER;
   Alert(msg);
   if(TerminalInfoInteger(TERMINAL_NOTIFICATIONS_ENABLED))
      SendNotification(msg);
   if(sound)
      PlaySound(sound_file);
  }

//+------------------------------------------------------------------+
//| Risk dashboard panel + action buttons (manual execution only)    |
//+------------------------------------------------------------------+
void AuraFX_DrawRiskDashboard(const long chartId,
                              const string prefix,
                              const int x, const int y,
                              const AuraFX_RiskState &st,
                              const AuraFX_TradeExposure &exp,
                              const string symbol)
  {
   int w = 320, h = 220;
   string panel = prefix + "_PANEL";
   color border_clr = AuraFX_RiskLevelColor(st.session_risk);
   if(st.mood == AURA_MOOD_DANGEROUS) border_clr = AURA_COLOR_RISK_HIGH;

   if(ObjectFind(chartId, panel) < 0)
     {
      ObjectCreate(chartId, panel, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(chartId, panel, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
      ObjectSetInteger(chartId, panel, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, panel, OBJPROP_HIDDEN, true);
     }
   ObjectSetInteger(chartId, panel, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(chartId, panel, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(chartId, panel, OBJPROP_XSIZE, w);
   ObjectSetInteger(chartId, panel, OBJPROP_YSIZE, h);
   ObjectSetInteger(chartId, panel, OBJPROP_BGCOLOR, AURA_COLOR_PANEL);
   ObjectSetInteger(chartId, panel, OBJPROP_COLOR, border_clr);
   ObjectSetInteger(chartId, panel, OBJPROP_WIDTH, 2);

   string mood = AuraFX_MoodText(st.mood);
   string lines[9];
   lines[0] = "RISK GUARDIAN";
   lines[1] = "Mood: " + mood;
   lines[2] = "Today HI events: " + IntegerToString(st.high_impact_today);
   if(st.news_imminent)
      lines[3] = StringFormat("NEXT: %s (%dm)", st.next_event.name, st.next_event.minutes_until);
   else
      lines[3] = "NEXT: No imminent high-impact event";
   lines[4] = "Alert: " + AuraFX_RiskLevelText(st.session_risk);
   lines[5] = "Impact: " + AuraFX_ImpactText(st.next_event.impact);
   if(exp.has_position)
      lines[6] = StringFormat("Exposure: %s %.2f | P/L %.2f", symbol, exp.volume, exp.profit);
   else
      lines[6] = "Exposure: No open trade";
   if(exp.adverse_move)
      lines[7] = "!! Trade risk increasing — check now";
   else
      lines[7] = st.news_imminent ? "Warn: volatility ahead" : "Position monitoring active";
   lines[8] = "Not advice — you decide";

   for(int i = 0; i < 9; i++)
     {
      string name = prefix + "_L" + IntegerToString(i);
      if(ObjectFind(chartId, name) < 0)
        {
         ObjectCreate(chartId, name, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(chartId, name, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
         ObjectSetInteger(chartId, name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(chartId, name, OBJPROP_HIDDEN, true);
        }
      ObjectSetInteger(chartId, name, OBJPROP_XDISTANCE, x + 14);
      ObjectSetInteger(chartId, name, OBJPROP_YDISTANCE, y + 10 + i * 20);
      ObjectSetString(chartId, name, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(chartId, name, OBJPROP_FONTSIZE, i == 0 ? 10 : 8);
      ObjectSetString(chartId, name, OBJPROP_TEXT, lines[i]);
      color c = AURA_COLOR_TEXT;
      if(i == 0) c = AURA_COLOR_GOLD;
      if(i == 1 && st.mood == AURA_MOOD_DANGEROUS) c = AURA_COLOR_RISK_HIGH;
      if(i == 4) c = AuraFX_RiskLevelColor(st.session_risk);
      if(i == 7 && exp.adverse_move) c = AURA_COLOR_RISK_HIGH;
      ObjectSetInteger(chartId, name, OBJPROP_COLOR, c);
     }

   // Action buttons — suggestions; EA/indicator handles click
   string btns[4] = {"Close", "Reduce", "Move SL", "Ignore"};
   for(int b = 0; b < 4; b++)
     {
      string bname = prefix + "_BTN" + IntegerToString(b);
      if(ObjectFind(chartId, bname) < 0)
        {
         ObjectCreate(chartId, bname, OBJ_BUTTON, 0, 0, 0);
         ObjectSetInteger(chartId, bname, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
         ObjectSetInteger(chartId, bname, OBJPROP_XSIZE, 70);
         ObjectSetInteger(chartId, bname, OBJPROP_YSIZE, 18);
         ObjectSetInteger(chartId, bname, OBJPROP_FONTSIZE, 8);
         ObjectSetInteger(chartId, bname, OBJPROP_COLOR, AURA_COLOR_TEXT);
         ObjectSetInteger(chartId, bname, OBJPROP_BGCOLOR, C'30,35,50');
         ObjectSetInteger(chartId, bname, OBJPROP_BORDER_COLOR, AURA_COLOR_GOLD_DIM);
        }
      ObjectSetInteger(chartId, bname, OBJPROP_XDISTANCE, x + 14 + b * 74);
      ObjectSetInteger(chartId, bname, OBJPROP_YDISTANCE, y + h - 28);
      ObjectSetString(chartId, bname, OBJPROP_TEXT, btns[b]);
     }
   ChartRedraw(chartId);
  }

//+------------------------------------------------------------------+
bool AuraFX_FetchNewsJSON(const string url, string &json_out, const int timeout_ms = 5000)
  {
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   int res = WebRequest("GET", url, headers, timeout_ms, data, result, headers);
   if(res != 200)
      return false;
   json_out = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return (StringLen(json_out) > 10);
  }

//+------------------------------------------------------------------+
ENUM_AURA_WARN_ACTION AuraFX_ParseButtonClick(const string obj_name, const string prefix)
  {
   if(StringFind(obj_name, prefix + "_BTN0") >= 0) return AURA_ACTION_CLOSE;
   if(StringFind(obj_name, prefix + "_BTN1") >= 0) return AURA_ACTION_REDUCE_LOT;
   if(StringFind(obj_name, prefix + "_BTN2") >= 0) return AURA_ACTION_MOVE_SL;
   if(StringFind(obj_name, prefix + "_BTN3") >= 0) return AURA_ACTION_IGNORE;
   return AURA_ACTION_NONE;
  }

void AuraFX_DeleteRiskDashboard(const long chartId, const string prefix)
  {
   ObjectsDeleteAll(chartId, prefix);
  }

#endif // AURAFX_NEWSRISK_MQH
