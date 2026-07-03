//+------------------------------------------------------------------+
//| AuraFX_Check_Algo.mq5 — run once to diagnose why no trades       |
//+------------------------------------------------------------------+
#property copyright "Aura Elite FX"
#property version   "1.00"
#property description "Drag onto chart — tells you if Algo Trading is blocking orders."
#property script_show_inputs

void OnStart()
  {
   bool term = TerminalInfoInteger(TERMINAL_TRADE_ALLOWED);
   bool expert = MQLInfoInteger(MQL_TRADE_ALLOWED);
   bool acctExpert = AccountInfoInteger(ACCOUNT_TRADE_EXPERT);
   bool acctTrade = AccountInfoInteger(ACCOUNT_TRADE_ALLOWED);
   bool demo = (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO);

   string msg = "=== AuraFX ALGO CHECK ===\n";
   msg += StringFormat("Demo account: %s\n", demo ? "YES" : "NO (use demo!)");
   msg += StringFormat("Terminal allows trading: %s\n", term ? "YES" : "NO — click Algo Trading button");
   msg += StringFormat("EA allowed on this chart: %s\n", expert ? "YES" : "NO — enable in EA settings");
   msg += StringFormat("Account allows EAs: %s\n", acctExpert ? "YES" : "NO — broker setting");
   msg += StringFormat("Account trade allowed: %s\n", acctTrade ? "YES" : "NO");

   if(term && expert && acctExpert && acctTrade)
      msg += "\n✓ READY — attach AuraFX_M1_Hyper_Scalper on M1 chart.\nLook for smiley face top-right of chart.";
   else
      msg += "\n✗ BLOCKED — fix items above, then smiley face appears.\n";
   msg += "\n1. Toolbar: Algo Trading = GREEN\n";
   msg += "2. Tools → Options → Expert Advisors → Allow algorithmic trading\n";
   msg += "3. Drag EA → Common tab → Allow Algo Trading = ticked\n";
   msg += "4. Use EXPERT (robot) not INDICATOR (signals only)";

   Alert(msg);
   Print(msg);
   Comment(msg);
  }
