/**
 * Web stand-in for react-native-google-mobile-ads.
 * Native builds import the real package. These IDs are Google's public test units.
 */
import { useEffect, useState } from 'react';

export const TestIds = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741',
};

export const BannerAdSize = {
  BANNER: 'BANNER',
  ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
  LARGE_ANCHORED_ADAPTIVE_BANNER: 'LARGE_ANCHORED_ADAPTIVE_BANNER',
};

export function BannerAd() {
  return null;
}

export function useRewardedAd() {
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  useEffect(() => {
    setStatus('error');
  }, []);
  return {
    status,
    autoLoad: false,
    earnedReward: false,
    error: { message: 'Rewarded test ads run in the iOS and Android build.' },
    show: () => undefined,
    load: () => undefined,
    retry: () => undefined,
    destroy: () => undefined,
  };
}

export function MobileAds() {
  return {
    initialize: async () => [],
  };
}

export default MobileAds;
