//+------------------------------------------------------------------+
//| AuraFX_MultiSymbol.mqh — One-chart multi-pair router             |
//+------------------------------------------------------------------+
#ifndef AURAFX_MULTISYMBOL_MQH
#define AURAFX_MULTISYMBOL_MQH

int AuraFX_SplitSymbols(const string csv, string &out[])
  {
   ArrayResize(out, 0);
   string parts[];
   int n = StringSplit(csv, ',', parts);
   for(int i = 0; i < n; i++)
     {
      StringTrimLeft(parts[i]);
      StringTrimRight(parts[i]);
      if(StringLen(parts[i]) < 3) continue;
      int idx = ArraySize(out);
      ArrayResize(out, idx + 1);
      out[idx] = parts[i];
     }
   return ArraySize(out);
  }

string AuraFX_ResolveSymbol(const string base)
  {
   if(SymbolInfoInteger(base, SYMBOL_EXIST)) return base;
   int total = SymbolsTotal(false);
   for(int i = 0; i < total; i++)
     {
      string s = SymbolName(i, false);
      if(StringFind(s, base) == 0) return s;
     }
   return base;
  }

bool AuraFX_SymbolTradeable(const string symbol)
  {
   if(!SymbolInfoInteger(symbol, SYMBOL_EXIST)) return false;
   if(SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE) == SYMBOL_TRADE_MODE_DISABLED) return false;
   return true;
  }

int AuraFX_MagicForIndex(const int baseMagic, const int index)
  {
   return baseMagic + index + 1;
  }

#endif