//+------------------------------------------------------------------+
//| AuraFX_Index_Force_EA.mq5 — fast index trading US30 NAS GER40    |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "Index force EA — M5/M15 EMA crosses, many demo trades. Indices only."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_Pro.mqh>

input double InpLots           = 0.05;
input bool   InpAutoLots       = true;
input double InpRiskPct        = 1.0;
input int    InpSlAtrMult      = 2;
input int    InpTpAtrMult      = 3;
input int    InpFastEma        = 5;
input int    InpSlowEma        = 13;
input int    InpMagic          = 20260820;
input int    InpMaxPositions   = 2;
input bool   InpUseTrailing     = true;
input int    InpTrailAtrMult   = 2;
input bool   InpShowPanel        = true;

CTrade g_trade;
int g_hFast, g_hSlow, g_hAtr;
datetime g_bar = 0;
AuraFX_Stats g_stats;

int OnInit()
  {
   ENUM_AURA_ASSET a = AuraFX_DetectAsset(_Symbol);
   if(a != AURA_ASSET_INDEX)
      Alert("AuraFX Index Force: attach to US30, NAS100, US500, GER40, UK100, etc.");

   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(50);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   g_hFast = iMA(_Symbol, PERIOD_CURRENT, InpFastEma, 0, MODE_EMA, PRICE_CLOSE);
   g_hSlow = iMA(_Symbol, PERIOD_CURRENT, InpSlowEma, 0, MODE_EMA, PRICE_CLOSE);
   g_hAtr  = iATR(_Symbol, PERIOD_CURRENT, 14);
   return (g_hFast > 0 && g_hSlow > 0 && g_hAtr > 0) ? INIT_SUCCEEDED : INIT_FAILED;
  }

void OnDeinit(const int r)
  {
   if(g_hFast > 0) IndicatorRelease(g_hFast);
   if(g_hSlow > 0) IndicatorRelease(g_hSlow);
   if(g_hAtr > 0) IndicatorRelease(g_hAtr);
   AuraFX_DeletePanel(ChartID(), "AFX_IDX");
  }

double Atr() { return AuraFX_Buffer(g_hAtr, 0, 1); }

int CountPos()
  {
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(!PositionSelectByTicket(PositionGetTicket(i))) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      n++;
     }
   return n;
  }

void Trail()
  {
   if(!InpUseTrailing) return;
   double atr = Atr();
   if(atr <= 0) return;
   double dist = atr * InpTrailAtrMult;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      bool buy = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY;
      double sl = PositionGetDouble(POSITION_SL), tp = PositionGetDouble(POSITION_TP);
      double px = buy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double nsl = buy ? px - dist : px + dist;
      if(buy && nsl > sl) g_trade.PositionModify(t, nsl, tp);
      if(!buy && (sl == 0 || nsl < sl)) g_trade.PositionModify(t, nsl, tp);
     }
  }

void Open(const ENUM_ORDER_TYPE type)
  {
   double atr = Atr();
   if(atr <= 0) atr = 100 * _Point;
   double px = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                                        : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double sl = (type == ORDER_TYPE_BUY) ? px - atr * InpSlAtrMult : px + atr * InpSlAtrMult;
   double tp = (type == ORDER_TYPE_BUY) ? px + atr * InpTpAtrMult : px - atr * InpTpAtrMult;
   double lots = InpLots;
   if(InpAutoLots)
     {
      lots = AuraFX_CalcRiskLot(_Symbol, InpRiskPct, px, sl, AccountInfoDouble(ACCOUNT_BALANCE));
      if(lots <= 0) lots = InpLots;
     }
   g_trade.PositionOpen(_Symbol, type, lots, px, sl, tp, "AuraFX Index Force");
  }

void OnTick()
  {
   datetime b = iTime(_Symbol, PERIOD_CURRENT, 0);
   bool newBar = (b != g_bar);
   if(newBar) g_bar = b;

   Trail();

   if(!newBar) return;

   double f0 = AuraFX_Buffer(g_hFast, 0, 1), f1 = AuraFX_Buffer(g_hFast, 0, 2);
   double s0 = AuraFX_Buffer(g_hSlow, 0, 1), s1 = AuraFX_Buffer(g_hSlow, 0, 2);
   bool up = f0 > s0 && f1 <= s1;
   bool dn = f0 < s0 && f1 >= s1;

   ENUM_AURA_SIGNAL sig = AURA_SIGNAL_NONE;
   if(up) sig = AURA_SIGNAL_BUY;
   if(dn) sig = AURA_SIGNAL_SELL;

   if(InpShowPanel)
      AuraFX_DrawPanel(ChartID(), "AFX_IDX", 14, 24, sig, g_stats, _Symbol, AURA_ASSET_INDEX);

   if(CountPos() >= InpMaxPositions) return;
   if(up) Open(ORDER_TYPE_BUY);
   else if(dn) Open(ORDER_TYPE_SELL);
  }
