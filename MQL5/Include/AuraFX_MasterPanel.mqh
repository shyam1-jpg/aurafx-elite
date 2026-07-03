//+------------------------------------------------------------------+
//| AuraFX_MasterPanel.mqh — ONE unified HUD                         |
//+------------------------------------------------------------------+
#ifndef AURAFX_MASTERPANEL_MQH
#define AURAFX_MASTERPANEL_MQH

#include <AuraFX_Core.mqh>

#define AURA_ONE_PANEL_W  320
#define AURA_ONE_PANEL_H  248

void AuraFX_OneLabel(const long chartId, const string prefix, const int idx,
                     const int x, const int y, const string text, const color c,
                     const int fontSize = 9)
  {
   string name = prefix + "_L" + IntegerToString(idx);
   if(ObjectFind(chartId, name) < 0)
     {
      ObjectCreate(chartId, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(chartId, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(chartId, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, name, OBJPROP_HIDDEN, true);
      ObjectSetString(chartId, name, OBJPROP_FONT, "Segoe UI");
     }
   ObjectSetInteger(chartId, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(chartId, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(chartId, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetString(chartId, name, OBJPROP_TEXT, text);
   ObjectSetInteger(chartId, name, OBJPROP_COLOR, c);
  }

void AuraFX_OneButton(const long chartId, const string prefix, const string id,
                      const int x, const int y, const int w, const string caption)
  {
   string name = prefix + "_BTN_" + id;
   if(ObjectFind(chartId, name) < 0)
     {
      ObjectCreate(chartId, name, OBJ_BUTTON, 0, 0, 0);
      ObjectSetInteger(chartId, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(chartId, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, name, OBJPROP_HIDDEN, true);
     }
   ObjectSetInteger(chartId, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(chartId, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(chartId, name, OBJPROP_XSIZE, w);
   ObjectSetInteger(chartId, name, OBJPROP_YSIZE, 22);
   ObjectSetString(chartId, name, OBJPROP_TEXT, caption);
   ObjectSetInteger(chartId, name, OBJPROP_BGCOLOR, C'28,32,48');
   ObjectSetInteger(chartId, name, OBJPROP_COLOR, AURA_COLOR_TEXT);
   ObjectSetInteger(chartId, name, OBJPROP_BORDER_COLOR, AURA_COLOR_GOLD_DIM);
  }

void AuraFX_DrawWeeklyLevels(const long chartId, const string prefix,
                             const string symbol, const bool show)
  {
   string hiName = prefix + "_WK_HI";
   string loName = prefix + "_WK_LO";
   if(!show)
     {
      ObjectDelete(chartId, hiName);
      ObjectDelete(chartId, loName);
      return;
     }
   MqlRates w[];
   if(CopyRates(symbol, PERIOD_W1, 1, 1, w) < 1) return;
   double wh = w[0].high;
   double wl = w[0].low;
   datetime t0 = iTime(symbol, PERIOD_CURRENT, 0);
   datetime t1 = t0 + PeriodSeconds(PERIOD_CURRENT) * 80;
   for(int side = 0; side < 2; side++)
     {
      string nm = (side == 0) ? hiName : loName;
      double pr = (side == 0) ? wh : wl;
      if(ObjectFind(chartId, nm) < 0)
        {
         ObjectCreate(chartId, nm, OBJ_TREND, 0, t0, pr, t1, pr);
         ObjectSetInteger(chartId, nm, OBJPROP_RAY_RIGHT, true);
         ObjectSetInteger(chartId, nm, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(chartId, nm, OBJPROP_STYLE, STYLE_DASH);
        }
      else
        {
         ObjectSetDouble(chartId, nm, OBJPROP_PRICE, 0, pr);
         ObjectSetDouble(chartId, nm, OBJPROP_PRICE, 1, pr);
         ObjectSetInteger(chartId, nm, OBJPROP_TIME, 0, t0);
         ObjectSetInteger(chartId, nm, OBJPROP_TIME, 1, t1);
        }
      ObjectSetInteger(chartId, nm, OBJPROP_COLOR, AURA_COLOR_GOLD_DIM);
      ObjectSetInteger(chartId, nm, OBJPROP_WIDTH, 1);
     }
  }

void AuraFX_DrawMasterPanel(const long chartId, const string prefix,
                            const int x, const int y,
                            const string modeName,
                            const string statusLine,
                            const string line2,
                            const string line3,
                            const string line4,
                            const string line5,
                            const string line6,
                            const string line7,
                            const bool locked,
                            const bool showButtons)
  {
   string panel = prefix + "_PANEL";
   if(ObjectFind(chartId, panel) < 0)
     {
      ObjectCreate(chartId, panel, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(chartId, panel, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(chartId, panel, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, panel, OBJPROP_HIDDEN, true);
      ObjectSetInteger(chartId, panel, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(chartId, panel, OBJPROP_BACK, false);
     }
   ObjectSetInteger(chartId, panel, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(chartId, panel, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(chartId, panel, OBJPROP_XSIZE, AURA_ONE_PANEL_W);
   ObjectSetInteger(chartId, panel, OBJPROP_YSIZE, AURA_ONE_PANEL_H);
   ObjectSetInteger(chartId, panel, OBJPROP_BGCOLOR, AURA_COLOR_PANEL);
   ObjectSetInteger(chartId, panel, OBJPROP_COLOR, AURA_COLOR_GOLD_DIM);

   int lx = x + 14;
   int ly = y + 12;
   int step = 20;
   AuraFX_OneLabel(chartId, prefix, 0, lx, ly, "AURAFX ONE - WORLD ELITE", AURA_COLOR_GOLD, 11);
   AuraFX_OneLabel(chartId, prefix, 1, lx, ly + step, modeName, AURA_COLOR_TEXT);
   AuraFX_OneLabel(chartId, prefix, 2, lx, ly + step * 2, line2, AURA_COLOR_TEXT);
   AuraFX_OneLabel(chartId, prefix, 3, lx, ly + step * 3, line3, AURA_COLOR_TEXT);
   AuraFX_OneLabel(chartId, prefix, 4, lx, ly + step * 4, line4, AURA_COLOR_TEXT);
   AuraFX_OneLabel(chartId, prefix, 5, lx, ly + step * 5, line5, AURA_COLOR_TEXT);
   AuraFX_OneLabel(chartId, prefix, 6, lx, ly + step * 6, line6, AURA_COLOR_TEXT);
   color stCol = locked ? AURA_COLOR_SELL : AURA_COLOR_BUY;
   AuraFX_OneLabel(chartId, prefix, 7, lx, ly + step * 7, statusLine, stCol);
   AuraFX_OneLabel(chartId, prefix, 8, lx, ly + step * 8, line7, AURA_COLOR_MUTED, 8);

   if(showButtons)
     {
      int by = y + AURA_ONE_PANEL_H - 30;
      AuraFX_OneButton(chartId, prefix, "ALL", lx, by, 72, "Close All");
      AuraFX_OneButton(chartId, prefix, "BUY", lx + 78, by, 72, "Close Buys");
      AuraFX_OneButton(chartId, prefix, "SEL", lx + 156, by, 72, "Close Sells");
     }
   ChartRedraw(chartId);
  }

void AuraFX_DeleteMasterPanel(const long chartId, const string prefix)
  {
   ObjectsDeleteAll(chartId, prefix);
  }

#endif