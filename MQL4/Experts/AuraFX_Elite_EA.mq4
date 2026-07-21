//+------------------------------------------------------------------+
//| AuraFX_Elite_EA.mq4 - auto trade on fresh closed-bar signals     |
//+------------------------------------------------------------------+
#property copyright "AuraFX Labs"
#property version   "1.11"
#property strict
#include <AuraFX_Core.mqh>

input bool   InpEnableOrderExecution = false; // SAFE DEFAULT: signals only, never place/close orders
input double InpLots              = 0.01;
input double InpRiskPercent       = 1.0;
input bool   InpAutoLots          = true;
input int    InpSlPoints          = 200;
input int    InpTpPoints          = 400;
input int    InpMagic             = 202604;
input bool   InpUseSignalCandleSL = true;
input int    InpSlCandleBufferPts = 10;
input double InpTpRiskReward      = 2.0;
input int    InpMinSlPoints       = 20;
input int    InpMaxSlPoints       = 800;
input bool   InpUseTrailing         = true;
input int    InpTrailingPoints      = 120;
input bool   InpUseBreakeven        = true;
input int    InpBreakevenTriggerPts = 80;
input int    InpBreakevenLockPts    = 10;
input double InpMaxDailyLossPct     = 3.0;
input double InpRsiBuyMax     = 65.0;
input double InpRsiSellMin    = 35.0;
input double InpAtrMultMin    = 0.20;
input bool   InpRelaxedSignals  = true;
input bool   InpAllowCover      = true;
input bool   InpShowPanel       = true;
input bool   InpTradeAllTimeframes = true;

AuraFX_Stats g_stats;
datetime g_lastTradedSignalBar = 0;
datetime g_dayStart = 0;
double   g_dayStartBalance = 0;
const string PANEL_PREFIX = "AURAFX_EA";

int OnInit()
  {
   g_stats.targetRate=76;
   g_dayStart=iTime(Symbol(),PERIOD_D1,0);
   g_dayStartBalance=AccountBalance();
   if(!InpEnableOrderExecution)
      Print("AuraFX Elite: ANALYSIS-ONLY mode. Order execution is disabled.");
   else if(!AuraFX_CanTradeNow())
      Print("AuraFX EA: Enable AutoTrading and Allow live trading in EA settings");
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason){ AuraFX_DeletePanel(0,PANEL_PREFIX); Comment(""); }

void OnTick()
  {
   if(InpEnableOrderExecution) ManageOpenPositions();
   string status=InpEnableOrderExecution?"AuraFX EA active":"ANALYSIS ONLY: execution disabled";
   if(InpEnableOrderExecution && !AuraFX_CanTradeNow()) status="BLOCKED: Turn AutoTrading ON + allow live trading";
   else if(InpEnableOrderExecution && DailyLossLimitHit()) status="BLOCKED: Daily loss limit reached";
   else
     {
      datetime signalBarTime=iTime(Symbol(),Period(),1);
      ENUM_AURA_SIGNAL sig=AuraFX_ComputeSignal(Symbol(),Period(),1,InpRsiBuyMax,InpRsiSellMin,InpAtrMultMin,InpRelaxedSignals);
      if(!InpEnableOrderExecution)
        status="ANALYSIS ONLY | Signal: "+AuraFX_SignalToString(sig)+" | no order can be placed";
      else if(sig==AURA_SIGNAL_COVER && InpAllowCover) { CloseAllPositions(); status="COVER - positions closed"; }
      else if(sig==AURA_SIGNAL_BUY || sig==AURA_SIGNAL_SELL)
        {
         status="Signal: "+AuraFX_SignalToString(sig)+" on bar "+TimeToStr(signalBarTime);
         if(signalBarTime!=g_lastTradedSignalBar)
           {
            if(CountPositions(OP_BUY)>0 || CountPositions(OP_SELL)>0) CloseAllPositions();
            if(OpenTrade(sig==AURA_SIGNAL_BUY?OP_BUY:OP_SELL,1))
              { g_lastTradedSignalBar=signalBarTime; status+=" | ORDER OPENED"; }
            else status+=" | OrderSend failed err="+IntegerToString(GetLastError());
           }
         else status+=" | waiting for next signal bar";
        }
      else status="Scanning... (works on all timeframes)";
     }
   if(InpShowPanel)
     {
      ENUM_AURA_SIGNAL sig2=AuraFX_ComputeSignal(Symbol(),Period(),1,InpRsiBuyMax,InpRsiSellMin,InpAtrMultMin,InpRelaxedSignals);
      AuraFX_DrawPanel(0,PANEL_PREFIX,16,240,sig2,g_stats,Symbol(),AuraFX_DetectAsset(Symbol()));
     }
   Comment(status,"\n",AURA_DISCLAIMER);
  }

double CalcLots(double slDistancePrice)
  {
   if(!InpAutoLots) return(InpLots);
   double balance=AccountBalance();
   double tickVal=MarketInfo(Symbol(),MODE_TICKVALUE);
   double tickSz=MarketInfo(Symbol(),MODE_TICKSIZE);
   if(tickVal<=0||tickSz<=0) return(InpLots);
   double riskMoney=balance*InpRiskPercent/100.0;
   double slPrice=(slDistancePrice>0)?slDistancePrice:InpSlPoints*Point;
   if(slPrice<=0) return(InpLots);
   double lots=riskMoney/(slPrice/tickSz*tickVal);
   double minLot=MarketInfo(Symbol(),MODE_MINLOT);
   double maxLot=MarketInfo(Symbol(),MODE_MAXLOT);
   double step=MarketInfo(Symbol(),MODE_LOTSTEP);
   lots=MathFloor(lots/step)*step;
   return(MathMax(minLot,MathMin(maxLot,lots)));
  }

bool CalcSignalCandleSLTP(int type,double price,int signalShift,double &sl,double &tp)
  {
   sl=0; tp=0;
   double candleHigh=iHigh(Symbol(),Period(),signalShift);
   double candleLow=iLow(Symbol(),Period(),signalShift);
   if(candleHigh<=0||candleLow<=0) return(false);
   if(type==OP_BUY) sl=candleLow-InpSlCandleBufferPts*Point; else sl=candleHigh+InpSlCandleBufferPts*Point;
   double slDist=MathAbs(price-sl);
   double minDist=InpMinSlPoints*Point, maxDist=InpMaxSlPoints*Point;
   if(slDist<minDist){ sl=(type==OP_BUY)?price-minDist:price+minDist; slDist=minDist; }
   else if(slDist>maxDist){ sl=(type==OP_BUY)?price-maxDist:price+maxDist; slDist=maxDist; }
   if(InpTpRiskReward>0) tp=(type==OP_BUY)?price+slDist*InpTpRiskReward:price-slDist*InpTpRiskReward;
   sl=NormalizeDouble(sl,Digits); tp=NormalizeDouble(tp,Digits);
   return(true);
  }

bool CalcFixedSLTP(int type,double price,double &sl,double &tp)
  {
   sl=0; tp=0;
   if(InpSlPoints>0) sl=(type==OP_BUY)?price-InpSlPoints*Point:price+InpSlPoints*Point;
   if(InpTpPoints>0) tp=(type==OP_BUY)?price+InpTpPoints*Point:price-InpTpPoints*Point;
   if(sl>0) sl=NormalizeDouble(sl,Digits); if(tp>0) tp=NormalizeDouble(tp,Digits);
   return(true);
  }

bool EnforceBrokerStops(int type,double price,double &sl,double &tp)
  {
   int stopsLevel=(int)MarketInfo(Symbol(),MODE_STOPLEVEL);
   if(stopsLevel<=0) return(true);
   double minDist=stopsLevel*Point;
   if(sl>0&&MathAbs(price-sl)<minDist) sl=(type==OP_BUY)?price-minDist:price+minDist;
   if(tp>0&&MathAbs(price-tp)<minDist) tp=(type==OP_BUY)?price+minDist:price-minDist;
   if(sl>0) sl=NormalizeDouble(sl,Digits); if(tp>0) tp=NormalizeDouble(tp,Digits);
   return(true);
  }

bool OpenTrade(int type,int signalShift)
  {
   if(!InpEnableOrderExecution) return(false);
   if(!AuraFX_CanTradeNow()) return(false);
   RefreshRates();
   double price=(type==OP_BUY)?Ask:Bid;
   double sl=0,tp=0;
   if(InpUseSignalCandleSL){ if(!CalcSignalCandleSLTP(type,price,signalShift,sl,tp)) CalcFixedSLTP(type,price,sl,tp); }
   else CalcFixedSLTP(type,price,sl,tp);
   EnforceBrokerStops(type,price,sl,tp);
   double slDist=(sl>0)?MathAbs(price-sl):InpSlPoints*Point;
   double lots=CalcLots(slDist);
   if(lots<MarketInfo(Symbol(),MODE_MINLOT)) lots=MarketInfo(Symbol(),MODE_MINLOT);
   int ticket=OrderSend(Symbol(),type,lots,price,30,sl,tp,"AuraFX Elite",InpMagic,0,(type==OP_BUY)?clrGreen:clrRed);
   if(ticket<0){ Print("OrderSend fail ",GetLastError()," lots=",lots," sl=",sl," tp=",tp); return(false); }
   Print("AuraFX order opened ticket=",ticket," ",(type==OP_BUY?"BUY":"SELL")," lots=",lots);
   return(true);
  }

bool DailyLossLimitHit()
  {
   if(InpMaxDailyLossPct<=0) return(false);
   datetime today=iTime(Symbol(),PERIOD_D1,0);
   if(today!=g_dayStart){ g_dayStart=today; g_dayStartBalance=AccountBalance(); }
   if(g_dayStartBalance<=0) return(false);
   return(((g_dayStartBalance-AccountBalance())/g_dayStartBalance*100.0)>=InpMaxDailyLossPct);
  }

void ManageOpenPositions()
  {
   for(int i=OrdersTotal()-1;i>=0;i--)
     {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) continue;
      if(OrderSymbol()!=Symbol()||OrderMagicNumber()!=InpMagic) continue;
      if(OrderType()!=OP_BUY&&OrderType()!=OP_SELL) continue;
      int type=OrderType(); double openPrice=OrderOpenPrice();
      double currentSL=OrderStopLoss(), currentTP=OrderTakeProfit();
      if(type==OP_BUY)
        {
         double profitPts=(Bid-openPrice)/Point;
         if(InpUseBreakeven&&profitPts>=InpBreakevenTriggerPts){ double be=openPrice+InpBreakevenLockPts*Point; if(currentSL<be-Point && !OrderModify(OrderTicket(),openPrice,be,currentTP,0,clrNONE)) Print("AuraFX OrderModify breakeven failed: ",GetLastError()); }
         if(InpUseTrailing&&profitPts>=InpTrailingPoints){ double ts=Bid-InpTrailingPoints*Point; if(ts>currentSL+Point && !OrderModify(OrderTicket(),openPrice,ts,currentTP,0,clrNONE)) Print("AuraFX OrderModify trailing failed: ",GetLastError()); }
        }
      else
        {
         double profitPts=(openPrice-Ask)/Point;
         if(InpUseBreakeven&&profitPts>=InpBreakevenTriggerPts){ double be=openPrice-InpBreakevenLockPts*Point; if((currentSL==0||currentSL>be+Point) && !OrderModify(OrderTicket(),openPrice,be,currentTP,0,clrNONE)) Print("AuraFX OrderModify breakeven failed: ",GetLastError()); }
         if(InpUseTrailing&&profitPts>=InpTrailingPoints){ double ts=Ask+InpTrailingPoints*Point; if((currentSL==0||ts<currentSL-Point) && !OrderModify(OrderTicket(),openPrice,ts,currentTP,0,clrNONE)) Print("AuraFX OrderModify trailing failed: ",GetLastError()); }
        }
     }
  }

int CountPositions(int type)
  {
   int n=0;
   for(int i=OrdersTotal()-1;i>=0;i--){ if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) continue; if(OrderSymbol()!=Symbol()||OrderMagicNumber()!=InpMagic) continue; if(OrderType()==type) n++; }
   return(n);
  }

void CloseAllPositions()
  {
   if(!InpEnableOrderExecution) return;
   for(int i=OrdersTotal()-1;i>=0;i--)
     {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) continue;
      if(OrderSymbol()!=Symbol()||OrderMagicNumber()!=InpMagic) continue;
      int type=OrderType(); if(type!=OP_BUY&&type!=OP_SELL) continue;
      RefreshRates();
      if(!OrderClose(OrderTicket(),OrderLots(),(type==OP_BUY)?Bid:Ask,30,clrYellow))
         Print("AuraFX OrderClose failed: ",GetLastError());
     }
  }
