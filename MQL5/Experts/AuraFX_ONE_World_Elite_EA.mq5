//+------------------------------------------------------------------+
//| AuraFX_ONE_World_Elite_EA.mq5                                    |
//| Unified Gold Sovereign + Cross Guardian + Hybrid                 |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property link      "https://aurafxelite.com"
#property version   "1.00"
#property description "AuraFX ONE: XAUUSD H1 structure engine + AUD cross M15 mean reversion."
#property description "Educational only - no guaranteed profit. Demo and backtest first."

#include <Trade\Trade.mqh>
#include <AuraFX_Core.mqh>
#include <AuraFX_Pro.mqh>
#include <AuraFX_Structure.mqh>
#include <AuraFX_NewsRisk.mqh>
#include <AuraFX_GridEngine.mqh>
#include <AuraFX_MasterPanel.mqh>
#include <AuraFX_MultiSymbol.mqh>
#include <AuraFX_MeanReversion.mqh>

enum AURA_ONE_MODE
  {
   GOLD   = 0,   // Gold Sovereign XAUUSD H1
   CROSS  = 1,   // Cross Guardian AUD crosses M15
   HYBRID = 2    // Both engines
  };

enum AURA_ONE_RISK
  {
   LOW    = 0,
   MEDIUM = 1,
   HIGH   = 2
  };

input group "=== AuraFX ONE - Mode ==="
input AURA_ONE_MODE InpMode         = HYBRID;
input AURA_ONE_RISK InpRisk         = MEDIUM;
input int           InpMagicBase    = 20261020;

input group "=== Gold Sovereign (H1) ==="
input string            InpGoldSymbol     = "XAUUSD";
input ENUM_TIMEFRAMES   InpGoldTF         = PERIOD_H1;
input bool              InpGoldStructure  = true;
input bool              InpGoldWeeklyLv   = true;
input bool              InpGoldTrailing   = true;
input int               InpGoldTrailAtr = 2;
input int               InpGoldMaxSpread  = 45;

input group "=== Cross Guardian (M15) ==="
input string          InpCrossSymbols   = "AUDCAD,AUDNZD,NZDCAD";
input ENUM_TIMEFRAMES InpCrossTF        = PERIOD_M15;
input int             InpCrossMaxSpread = 28;
input int             InpCrossMaxGrid   = 4;
input double          InpCrossGridAtr   = 0.75;
input double          InpCrossLotStep   = 0.12;
input double          InpCrossMaxLotMult= 1.35;
input double          InpCrossBasketTpAtr = 0.5;
input double          InpCrossBasketSlAtr = 2.5;

input group "=== Money management ==="
input bool   InpAutoLot    = true;
input double InpFixedLot   = 0.01;
input double InpMinRR      = 1.6;

input group "=== Risk Shield ==="
input int    InpNewsBlockMin = 40;
input double InpDailyLossPct = 3.0;
input double InpWeeklyLossPct= 6.0;
input double InpMaxDrawdownPct= 12.0;
input bool   InpCloseOnLock  = true;   // Close all ONE trades when limit hit

input group "=== Panel ==="
input bool InpShowPanel   = true;
input int  InpPanelX      = 12;
input int  InpPanelY      = 18;
input bool InpPanelButtons= true;

const string ONE = "AURAFX_ONE";
const int    ONE_MAGIC_SPAN = 16;

CTrade g_trade;
AuraFX_ProState g_pro;
AuraFX_StructureState g_goldStruct;
AuraFX_BasketStats g_crossBasket[];
string g_crossSyms[];
datetime g_lastGoldBar = 0;
string g_statusExtra = "";
double g_floatPnL = 0.0;
bool   g_hadLock = false;

//+------------------------------------------------------------------+
string ModeLabel()
  {
   if(InpMode == GOLD)   return "MODE: Gold Sovereign (XAU H1)";
   if(InpMode == CROSS)  return "MODE: Cross Guardian (AUD M15)";
   return "MODE: Hybrid (Gold + Cross)";
  }

string SessionLabel()
  {
   switch(AuraFX_GetSessionGMT())
     {
      case AURA_SESSION_ASIAN:   return "Asian";
      case AURA_SESSION_LONDON:  return "London";
      case AURA_SESSION_NEWYORK: return "New York";
      case AURA_SESSION_OVERLAP: return "London/NY overlap";
      default:                   return "Off-hours";
     }
  }

double RiskPctForPreset()
  {
   if(InpRisk == LOW)    return 0.5;
   if(InpRisk == HIGH)   return 1.5;
   return 1.0;
  }

int GoldMinScore()
  {
   if(InpRisk == LOW)    return 78;
   if(InpRisk == HIGH)   return 58;
   return 68;
  }

bool ModeUsesGold()
  {
   if(InpMode == GOLD) return true;
   if(InpMode == HYBRID) return true;
   return false;
  }

bool ModeUsesCross()
  {
   if(InpMode == CROSS) return true;
   if(InpMode == HYBRID) return true;
   return false;
  }

bool SpreadOkSymbol(const string sym, const int maxPts)
  {
   if(maxPts <= 0) return true;
   return (int)SymbolInfoInteger(sym, SYMBOL_SPREAD) <= maxPts;
  }

double SymbolAtr(const string sym, const ENUM_TIMEFRAMES tf)
  {
   int h = iATR(sym, tf, 14);
   if(h == INVALID_HANDLE) return 100 * SymbolInfoDouble(sym, SYMBOL_POINT);
   double v[];
   ArraySetAsSeries(v, true);
   if(CopyBuffer(h, 0, 1, 1, v) < 1) { IndicatorRelease(h); return 100 * SymbolInfoDouble(sym, SYMBOL_POINT); }
   IndicatorRelease(h);
   return (v[0] > 0) ? v[0] : 100 * SymbolInfoDouble(sym, SYMBOL_POINT);
  }

double CrossLotScale(const string sym, const int level, const double baseLot)
  {
   if(level <= 0) return baseLot;
   double mult = 1.0 + level * InpCrossLotStep;
   mult = MathMin(mult, InpCrossMaxLotMult);
   double lots = baseLot * mult;
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   double minl = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double maxl = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   lots = MathFloor(lots / step) * step;
   return MathMax(minl, MathMin(maxl, lots));
  }

double CalcBaseLot(const string sym, const double entry, const double sl)
  {
   if(!InpAutoLot) return InpFixedLot;
   return AuraFX_CalcRiskLot(sym, RiskPctForPreset(), entry, sl,
                             AccountInfoDouble(ACCOUNT_BALANCE));
  }

bool RiskShieldBlocks(const string sym)
  {
   if(g_pro.trading_locked) return true;
   AuraFX_CalendarEvent next;
   if(AuraFX_NewsBlocksEntry(sym, InpNewsBlockMin, next))
     {
      g_pro.news_block_entry = true;
      return true;
     }
   g_pro.news_block_entry = false;
   return false;
  }

void RefreshRiskShield()
  {
   bool wasLocked = g_pro.trading_locked;
   AuraFX_CheckLossLimits(InpDailyLossPct, InpWeeklyLossPct, InpMaxDrawdownPct,
                          g_pro.daily_pnl_pct, g_pro.weekly_pnl_pct,
                          g_pro.trading_locked, g_pro.lock_reason);

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   if(balance > 0 && !g_pro.trading_locked)
     {
      g_floatPnL = CollectFloatPnL();
      double effectiveDaily = g_pro.daily_pnl_pct + (100.0 * g_floatPnL / balance);
      if(InpDailyLossPct > 0 && effectiveDaily <= -InpDailyLossPct)
        {
         g_pro.trading_locked = true;
         g_pro.lock_reason = "Daily loss limit (open + closed)";
        }
     }

   if(g_pro.trading_locked && InpCloseOnLock && !wasLocked && !g_hadLock)
     {
      CloseMagicRange(0);
      g_hadLock = true;
      Alert("AuraFX ONE: ", g_pro.lock_reason, " — all positions closed.");
     }
   if(!g_pro.trading_locked)
      g_hadLock = false;
  }

double CollectFloatPnL()
  {
   double p = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      int mg = (int)PositionGetInteger(POSITION_MAGIC);
      if(mg < InpMagicBase || mg >= InpMagicBase + ONE_MAGIC_SPAN) continue;
      p += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
     }
   return p;
  }

void CloseMagicRange(const int filter)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      int mg = (int)PositionGetInteger(POSITION_MAGIC);
      if(mg < InpMagicBase || mg >= InpMagicBase + ONE_MAGIC_SPAN) continue;
      long typ = PositionGetInteger(POSITION_TYPE);
      if(filter == 1 && typ != POSITION_TYPE_BUY) continue;
      if(filter == 2 && typ != POSITION_TYPE_SELL) continue;
      g_trade.PositionClose(t);
     }
  }

void TrailGoldPositions()
  {
   if(!InpGoldTrailing) return;
   string sym = AuraFX_ResolveSymbol(InpGoldSymbol);
   double atr = SymbolAtr(sym, InpGoldTF);
   double trail = atr * InpGoldTrailAtr;
   int magic = InpMagicBase;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != sym) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
        {
         double bid = SymbolInfoDouble(sym, SYMBOL_BID);
         double nsl = bid - trail;
         if(nsl > sl) g_trade.PositionModify(t, nsl, tp);
        }
      else
        {
         double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
         double nsl = ask + trail;
         if(sl == 0 || nsl < sl) g_trade.PositionModify(t, nsl, tp);
        }
     }
  }

bool GoldHasPosition()
  {
   string sym = AuraFX_ResolveSymbol(InpGoldSymbol);
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != sym) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) == InpMagicBase) return true;
     }
   return false;
  }

void RunGoldEngine(const bool newBar)
  {
   if(!ModeUsesGold()) return;
   string sym = AuraFX_ResolveSymbol(InpGoldSymbol);
   if(!AuraFX_SymbolTradeable(sym)) return;

   TrailGoldPositions();

   if(!newBar) return;
   if(RiskShieldBlocks(sym)) return;
   if(!SpreadOkSymbol(sym, InpGoldMaxSpread)) return;

   AuraFX_AnalyzeStructure(sym, InpGoldTF, g_goldStruct);
   ENUM_AURA_SIGNAL sig = AuraFX_ComputeSignal(sym, InpGoldTF, 1, 65, 35, 0.28);
   AuraFX_ComputeProScore(sym, sig, g_pro, InpNewsBlockMin, InpMinRR);

   if(sig == AURA_SIGNAL_NONE || sig == AURA_SIGNAL_COVER) return;
   if(g_pro.score.total < GoldMinScore()) return;

   if(InpGoldStructure)
     {
      if(sig == AURA_SIGNAL_BUY && !(g_goldStruct.bias >= 0 || g_goldStruct.bullish_ob || g_goldStruct.bos_up)) return;
      if(sig == AURA_SIGNAL_SELL && !(g_goldStruct.bias <= 0 || g_goldStruct.bearish_ob || g_goldStruct.bos_down)) return;
     }

   if(GoldHasPosition()) return;

   double atr = SymbolAtr(sym, InpGoldTF);
   double pt = SymbolInfoDouble(sym, SYMBOL_POINT);
   ENUM_ORDER_TYPE ot = (sig == AURA_SIGNAL_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   double px = (ot == ORDER_TYPE_BUY) ? SymbolInfoDouble(sym, SYMBOL_ASK) : SymbolInfoDouble(sym, SYMBOL_BID);
   double sl = (ot == ORDER_TYPE_BUY) ? px - atr * 1.8 : px + atr * 1.8;
   double tp = (ot == ORDER_TYPE_BUY) ? px + atr * InpMinRR * 1.8 : px - atr * InpMinRR * 1.8;
   double lots = CalcBaseLot(sym, px, sl);
   if(lots <= 0) return;

   g_trade.SetExpertMagicNumber(InpMagicBase);
   g_trade.PositionOpen(sym, ot, lots, px, sl, tp, "AuraFX ONE Gold");
  }

void RunCrossSymbol(const int idx)
  {
   if(idx < 0 || idx >= ArraySize(g_crossSyms)) return;
   string sym = g_crossSyms[idx];
   if(!AuraFX_SymbolTradeable(sym)) return;
   int magic = AuraFX_MagicForIndex(InpMagicBase, idx);

   AuraFX_BasketStats b;
   AuraFX_BasketCollect(sym, magic, b);

   double atr = SymbolAtr(sym, InpCrossTF);
   double pt = SymbolInfoDouble(sym, SYMBOL_POINT);
   double gridStepPts = (atr * InpCrossGridAtr) / pt;
   double basketTpPts = (atr * InpCrossBasketTpAtr) / pt;
   double basketSlPts = (atr * InpCrossBasketSlAtr) / pt;

   if(b.count > 0)
     {
      if(AuraFX_BasketTpHit(b, basketTpPts) || AuraFX_BasketSlHit(b, basketSlPts))
        {
         AuraFX_CloseBasket(g_trade, sym, magic);
         return;
        }
     }

   if(RiskShieldBlocks(sym)) return;
   if(!SpreadOkSymbol(sym, InpCrossMaxSpread)) return;

   ENUM_AURA_SIGNAL sig = AuraFX_BBRSI_Signal(sym, InpCrossTF);
   if(sig == AURA_SIGNAL_NONE) return;

   ENUM_ORDER_TYPE ot = (sig == AURA_SIGNAL_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   ENUM_AURA_GRID_SIDE want = (sig == AURA_SIGNAL_BUY) ? AURA_GRID_BUY : AURA_GRID_SELL;

   if(b.count == 0)
     {
      double px = (ot == ORDER_TYPE_BUY) ? SymbolInfoDouble(sym, SYMBOL_ASK) : SymbolInfoDouble(sym, SYMBOL_BID);
      double sl = (ot == ORDER_TYPE_BUY) ? px - atr * 1.2 : px + atr * 1.2;
      double tp = (ot == ORDER_TYPE_BUY) ? px + atr * 0.9 : px - atr * 0.9;
      double lots = CalcBaseLot(sym, px, sl);
      g_trade.SetExpertMagicNumber(magic);
      g_trade.PositionOpen(sym, ot, lots, px, sl, tp, "AuraFX ONE Cross");
      return;
     }

   if(b.side == want && AuraFX_CanAddGrid(b, InpCrossMaxGrid, gridStepPts, want))
     {
      double px = (ot == ORDER_TYPE_BUY) ? SymbolInfoDouble(sym, SYMBOL_ASK) : SymbolInfoDouble(sym, SYMBOL_BID);
      double sl = (ot == ORDER_TYPE_BUY) ? px - atr * 1.5 : px + atr * 1.5;
      double lots = CrossLotScale(sym, b.grid_level + 1, CalcBaseLot(sym, px, sl));
      g_trade.SetExpertMagicNumber(magic);
      g_trade.PositionOpen(sym, ot, lots, px, sl, 0, "AuraFX ONE Cross grid");
     }
  }

void RunCrossEngine()
  {
   if(!ModeUsesCross()) return;
   for(int i = 0; i < ArraySize(g_crossSyms); i++)
      RunCrossSymbol(i);
  }

string BasketSummary()
  {
   int total = 0;
   string parts = "";
   for(int i = 0; i < ArraySize(g_crossSyms); i++)
     {
      AuraFX_BasketStats b;
      AuraFX_BasketCollect(g_crossSyms[i], AuraFX_MagicForIndex(InpMagicBase, i), b);
      if(b.count == 0) continue;
      total += b.count;
      if(StringLen(parts) > 0) parts += " | ";
      parts += g_crossSyms[i] + " L" + IntegerToString(b.count);
     }
   if(total == 0) return "Baskets: flat";
   return "Baskets: " + parts;
  }

void DrawHud()
  {
   if(!InpShowPanel) return;
   string sym = AuraFX_ResolveSymbol(InpGoldSymbol);
   int spread = (int)SymbolInfoInteger(sym, SYMBOL_SPREAD);
   string newsTxt = g_pro.news_block_entry ? "News: BLOCKED" : "News: clear";
   string spreadTxt = StringFormat("Spread %s: %d pts", sym, spread);
   string pnlTxt = StringFormat("Float P/L $%.2f | Day %.2f%%", g_floatPnL, g_pro.daily_pnl_pct);
   string sessTxt = "Session: " + SessionLabel();
   string goldTxt = ModeUsesGold() ? StringFormat("Gold %s score>=%d", sym, GoldMinScore()) : "Gold: off";
   string crossTxt = ModeUsesCross() ? StringFormat("Cross %d pairs M15", ArraySize(g_crossSyms)) : "Cross: off";
   string lockTxt = g_pro.trading_locked ? ("LOCK: " + g_pro.lock_reason) : "Risk Shield: active";

   AuraFX_DrawMasterPanel(ChartID(), ONE, InpPanelX, InpPanelY,
                          ModeLabel(),
                          lockTxt,
                          sessTxt,
                          pnlTxt,
                          spreadTxt,
                          newsTxt,
                          goldTxt + " | " + crossTxt,
                          BasketSummary(),
                          g_pro.trading_locked,
                          InpPanelButtons);

   if(InpGoldWeeklyLv && ModeUsesGold())
      AuraFX_DrawWeeklyLevels(ChartID(), ONE, sym, true);
   else
      AuraFX_DrawWeeklyLevels(ChartID(), ONE, sym, false);
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   g_trade.SetDeviationInPoints(30);
   g_trade.SetTypeFillingBySymbol(_Symbol);

   AuraFX_SplitSymbols(InpCrossSymbols, g_crossSyms);
   for(int i = 0; i < ArraySize(g_crossSyms); i++)
      g_crossSyms[i] = AuraFX_ResolveSymbol(g_crossSyms[i]);

   ArrayResize(g_crossBasket, ArraySize(g_crossSyms));

   if(InpMode == HYBRID)
      EventSetTimer(5);
   else if(InpMode == CROSS)
      EventSetTimer(15);

   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
      Alert("AuraFX ONE: enable Algo Trading.");

   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   AuraFX_DeleteMasterPanel(ChartID(), ONE);
  }

void OnTimer()
  {
   RefreshRiskShield();
   g_floatPnL = CollectFloatPnL();
   RunCrossEngine();
   if(ModeUsesGold())
     {
      string gsym = AuraFX_ResolveSymbol(InpGoldSymbol);
      datetime bar = iTime(gsym, InpGoldTF, 0);
      bool newBar = (bar != g_lastGoldBar && bar > 0);
      if(newBar) g_lastGoldBar = bar;
      RunGoldEngine(newBar);
     }
   DrawHud();
  }

void OnTick()
  {
   RefreshRiskShield();
   g_floatPnL = CollectFloatPnL();

   if(InpMode == GOLD)
     {
      string sym = AuraFX_ResolveSymbol(InpGoldSymbol);
      datetime bar = iTime(sym, InpGoldTF, 0);
      bool newBar = (bar != g_lastGoldBar && bar > 0);
      if(newBar) g_lastGoldBar = bar;
      RunGoldEngine(newBar);
     }
   else if(InpMode == CROSS)
      RunCrossEngine();

   DrawHud();
  }

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
   if(id != CHARTEVENT_OBJECT_CLICK || !InpPanelButtons) return;
   if(StringFind(sparam, ONE + "_BTN_") != 0) return;
   if(StringFind(sparam, "_BTN_ALL") > 0) CloseMagicRange(0);
   else if(StringFind(sparam, "_BTN_BUY") > 0) CloseMagicRange(1);
   else if(StringFind(sparam, "_BTN_SEL") > 0) CloseMagicRange(2);
   ObjectSetInteger(ChartID(), sparam, OBJPROP_STATE, false);
   ChartRedraw();
  }
//+------------------------------------------------------------------+