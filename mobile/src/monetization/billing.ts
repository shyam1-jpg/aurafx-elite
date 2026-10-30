import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesStoreProduct } from 'react-native-purchases';

import { PRODUCT_IDS, tierForProduct, type PaidTier } from './products';

export type BillingStatus = {
  configured: boolean;
  tier: PaidTier | null;
  detail: string;
};

function keyForPlatform(): string {
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';
  return '';
}

let configured = false;

export function billingConfigured(): boolean {
  return configured;
}

export async function configureBilling(): Promise<BillingStatus> {
  if (Platform.OS === 'web') {
    return {
      configured: false,
      tier: null,
      detail: 'Subscriptions bill through the App Store and Google Play. This preview does not grant Pro or Elite.',
    };
  }
  const apiKey = keyForPlatform().trim();
  if (!apiKey) {
    return {
      configured: false,
      tier: null,
      detail: 'RevenueCat is not connected. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY or EXPO_PUBLIC_REVENUECAT_ANDROID_KEY. Product IDs stay reserved and this build will not grant a paid tier without a store receipt.',
    };
  }
  if (!configured) {
    Purchases.setLogLevel(LOG_LEVEL.INFO);
    Purchases.configure({ apiKey });
    configured = true;
  }
  const info = await Purchases.getCustomerInfo();
  return {
    configured: true,
    tier: tierFromCustomer(info),
    detail: 'Store receipts are read from RevenueCat.',
  };
}

export function tierFromCustomer(info: CustomerInfo | null | undefined): PaidTier | null {
  if (!info) return null;
  const active = info.entitlements?.active || {};
  let tier: PaidTier | null = null;
  Object.values(active).forEach((entitlement) => {
    const fromProduct = tierForProduct(entitlement?.productIdentifier);
    const fromId = tierForProduct(entitlement?.identifier);
    const next = fromProduct || fromId;
    if (next === 'elite' || (next === 'pro' && tier !== 'elite')) tier = next;
    if (entitlement?.identifier === 'elite') tier = 'elite';
    if (entitlement?.identifier === 'pro' && tier !== 'elite') tier = 'pro';
  });
  (info.activeSubscriptions || []).forEach((productId) => {
    const next = tierForProduct(productId);
    if (next === 'elite' || (next === 'pro' && tier !== 'elite')) tier = next;
  });
  return tier;
}

export async function loadStoreProducts(): Promise<PurchasesStoreProduct[]> {
  if (!configured || Platform.OS === 'web') return [];
  return Purchases.getProducts([...PRODUCT_IDS]);
}

export async function purchaseProduct(product: PurchasesStoreProduct): Promise<BillingStatus> {
  const result = await Purchases.purchaseStoreProduct(product);
  return {
    configured: true,
    tier: tierFromCustomer(result.customerInfo),
    detail: 'The store returned a receipt.',
  };
}

export async function restorePurchases(): Promise<BillingStatus> {
  if (!configured) {
    return configureBilling();
  }
  const info = await Purchases.restorePurchases();
  return {
    configured: true,
    tier: tierFromCustomer(info),
    detail: info.activeSubscriptions?.length
      ? 'Restored purchases from the store account.'
      : 'The store account has no active AuraFX subscription.',
  };
}

export function purchaseErrorText(error: unknown): string {
  if (error && typeof error === 'object' && 'userCancelled' in error) {
    const cancelled = (error as { userCancelled?: boolean }).userCancelled;
    if (cancelled) return 'The purchase was cancelled.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'The store did not complete the purchase.';
}
