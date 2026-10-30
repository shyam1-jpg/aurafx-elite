import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  getMarkets,
  getPlans,
  getPricing,
  getSignalBoard,
  getTrackRecord,
} from '../api/client';
import type {
  LoadState,
  MarketsPayload,
  PlansPayload,
  Pricing,
  SignalBoard,
  TrackRecord,
} from '../api/types';
import { loadingState } from '../api/types';
import {
  billingConfigured,
  configureBilling,
  loadStoreProducts,
  purchaseErrorText,
  purchaseProduct,
  restorePurchases,
  type BillingStatus,
} from '../monetization/billing';
import { prepareAds } from '../monetization/Ads';
import type { PaidTier } from '../monetization/products';
import { setupNotificationHandler } from '../notifications/setup';
import type { PurchasesStoreProduct } from 'react-native-purchases';

const WATCHLIST_KEY = 'aurafx.watchlist';

type AppContextValue = {
  signals: LoadState<SignalBoard>;
  track: LoadState<TrackRecord>;
  markets: LoadState<MarketsPayload>;
  pricing: LoadState<Pricing>;
  plans: LoadState<PlansPayload>;
  refresh: () => void;
  watchlist: string[];
  toggleWatch: (symbol: string) => void;
  tier: PaidTier | null;
  adsEnabled: boolean;
  billingDetail: string;
  storeProducts: PurchasesStoreProduct[];
  purchase: (product: PurchasesStoreProduct) => Promise<string | null>;
  restore: () => Promise<string | null>;
  unlocked: Record<string, true>;
  unlockDetail: (instrument: string) => void;
  detailOpen: (instrument: string) => boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

async function load<T>(task: () => Promise<T>): Promise<LoadState<T>> {
  try {
    const data = await task();
    return { status: 'ready', data, error: null };
  } catch (error) {
    return {
      status: 'error',
      data: null,
      error: error instanceof Error ? error.message : 'The request failed.',
    };
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [signals, setSignals] = useState<LoadState<SignalBoard>>(loadingState);
  const [track, setTrack] = useState<LoadState<TrackRecord>>(loadingState);
  const [markets, setMarkets] = useState<LoadState<MarketsPayload>>(loadingState);
  const [pricing, setPricing] = useState<LoadState<Pricing>>(loadingState);
  const [plans, setPlans] = useState<LoadState<PlansPayload>>(loadingState);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [tier, setTier] = useState<PaidTier | null>(null);
  const [billingDetail, setBillingDetail] = useState('Checking the store connection.');
  const [storeProducts, setStoreProducts] = useState<PurchasesStoreProduct[]>([]);
  const [unlocked, setUnlocked] = useState<Record<string, true>>({});

  const refresh = useCallback(() => {
    setSignals(loadingState);
    setTrack(loadingState);
    setMarkets(loadingState);
    setPricing(loadingState);
    setPlans(loadingState);
    load(getSignalBoard).then(setSignals);
    load(getTrackRecord).then(setTrack);
    load(getMarkets).then(setMarkets);
    load(getPricing).then(setPricing);
    load(getPlans).then(setPlans);
  }, []);

  useEffect(() => {
    refresh();
    prepareAds();
    setupNotificationHandler();
    AsyncStorage.getItem(WATCHLIST_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setWatchlist(parsed.filter((item): item is string => typeof item === 'string'));
        }
      })
      .catch(() => undefined);
    configureBilling()
      .then(async (status) => {
        applyBilling(status);
        if (billingConfigured()) {
          const products = await loadStoreProducts();
          setStoreProducts(products);
        }
      })
      .catch((error: unknown) => {
        setBillingDetail(purchaseErrorText(error));
      });
  }, [refresh]);

  const applyBilling = (status: BillingStatus) => {
    setTier(status.tier);
    setBillingDetail(status.detail);
  };

  const toggleWatch = useCallback((symbol: string) => {
    setWatchlist((current) => {
      const next = current.includes(symbol)
        ? current.filter((item) => item !== symbol)
        : [symbol, ...current];
      AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const purchase = useCallback(async (product: PurchasesStoreProduct) => {
    try {
      const status = await purchaseProduct(product);
      applyBilling(status);
      return null;
    } catch (error) {
      return purchaseErrorText(error);
    }
  }, []);

  const restore = useCallback(async () => {
    try {
      const status = await restorePurchases();
      applyBilling(status);
      if (billingConfigured()) {
        setStoreProducts(await loadStoreProducts());
      }
      return status.detail;
    } catch (error) {
      return purchaseErrorText(error);
    }
  }, []);

  const unlockDetail = useCallback((instrument: string) => {
    setUnlocked((current) => ({ ...current, [instrument]: true }));
  }, []);

  const detailOpen = useCallback(
    (instrument: string) => tier != null || unlocked[instrument] === true,
    [tier, unlocked],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      signals,
      track,
      markets,
      pricing,
      plans,
      refresh,
      watchlist,
      toggleWatch,
      tier,
      adsEnabled: tier == null,
      billingDetail,
      storeProducts,
      purchase,
      restore,
      unlocked,
      unlockDetail,
      detailOpen,
    }),
    [
      signals,
      track,
      markets,
      pricing,
      plans,
      refresh,
      watchlist,
      toggleWatch,
      tier,
      billingDetail,
      storeProducts,
      purchase,
      restore,
      unlocked,
      unlockDetail,
      detailOpen,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
