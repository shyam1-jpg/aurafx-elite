//+------------------------------------------------------------------+
//| AuraFX_Trade_Assistant.mq5 — on-chart trade helper panel         |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Trade Assistant style panel — signal, risk, lot hint. Analysis only."
#property indicator_chart_window
#property indicator_plots 0

#include <AuraFX_Core.mqh>
#include <AuraFX_Structure.mqh>

input double InpBalance = 10000;
input double InpRiskPct = 1.0;
input int    InpSlPips = 25;
input int    InpPanelX = 12;
input int    InpPanelY = 24;

AuraFX_Stats g_stats;
const string PFX = "AURAFX_TA";

int OnInit()
  {
   IndicatorSetString(INDICATOR_SHORTNAME, "AuraFX Trade Assistant");
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int r) { AuraFX_DeletePanel(ChartID(), PFX); ObjectsDeleteAll(ChartID(), PFX); }

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
   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(_Symbol, PERIOD_CURRENT, 1, 62, 38, 0.35);
   AuraFX_StructureState st;
   AuraFX_AnalyzeStructure(_Symbol, PERIOD_CURRENT, st);

   AuraFX_DrawPanel(ChartID(), PFX, InpPanelX, InpPanelY, sig, g_stats, _Symbol, AuraFX_DetectAsset(_Symbol));

   string extra = PFX + "_risk";
   if(ObjectFind(ChartID(), extra) < 0)
     {
      ObjectCreate(ChartID(), extra, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(ChartID(), extra, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetString(ChartID(), extra, OBJPROP_FONT, "Segoe UI");
      ObjectSetInteger(ChartID(), extra, OBJPROP_FONTSIZE, 9);
      ObjectSetInteger(ChartID(), extra, OBJPROP_COLOR, AURA_COLOR_MUTED);
     }
   double riskMoney = InpBalance * InpRiskPct / 100.0;
   double lots = 0.01;
   if(InpSlPips > 0) lots = MathMax(0.01, MathRound(riskMoney / (InpSlPips * 10.0) * 100) / 100);
   string structTxt = st.bos_up ? "BOS UP" : (st.bos_down ? "BOS DOWN" : "Range");
   ObjectSetInteger(ChartID(), extra, OBJPROP_XDISTANCE, InpPanelX + 14);
   ObjectSetInteger(ChartID(), extra, OBJPROP_YDISTANCE, InpPanelY + 200);
   ObjectSetString(ChartID(), extra, OBJPROP_TEXT,
      StringFormat("Risk $%.0f (%.1f%%) · Lots ~%.2f · Structure: %s", riskMoney, InpRiskPct, lots, structTxt));
   ChartRedraw();
   return rates_total;
  }
