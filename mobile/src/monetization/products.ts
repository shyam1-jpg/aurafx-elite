export const PRODUCT_MONTHLY = 'aurafx_pro_monthly';
export const PRODUCT_YEARLY = 'aurafx_pro_yearly';

export const PRODUCT_IDS = [PRODUCT_MONTHLY, PRODUCT_YEARLY] as const;

export type PaidTier = 'pro' | 'elite';

export type StoreProductPlan = {
  id: (typeof PRODUCT_IDS)[number];
  tier: PaidTier;
  siteTierId: 'pro' | 'elite';
  cadence: 'month' | 'year';
  title: string;
  detail: string;
};

export const STORE_PLANS: StoreProductPlan[] = [
  {
    id: PRODUCT_MONTHLY,
    tier: 'pro',
    siteTierId: 'pro',
    cadence: 'month',
    title: 'Pro monthly',
    detail: 'Maps to the site Pro tier. Removes ads and opens extra signal detail.',
  },
  {
    id: PRODUCT_YEARLY,
    tier: 'elite',
    siteTierId: 'elite',
    cadence: 'year',
    title: 'Elite yearly',
    detail: 'Maps to the site Elite tier, billed yearly. Removes ads and opens extra signal detail.',
  },
];

export function tierForProduct(productId: string | null | undefined): PaidTier | null {
  if (productId === PRODUCT_YEARLY) return 'elite';
  if (productId === PRODUCT_MONTHLY) return 'pro';
  return null;
}
