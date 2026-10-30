export const PRODUCT_IDS = [
  'aurafx_pro_monthly',
  'aurafx_pro_yearly',
  'aurafx_elite_monthly',
  'aurafx_elite_yearly',
] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];
export type PaidTier = 'pro' | 'elite';

export type StoreProductPlan = {
  id: ProductId;
  tier: PaidTier;
  siteTierId: 'pro' | 'elite';
  cadence: 'month' | 'year';
  title: string;
  detail: string;
};

export const STORE_PLANS: StoreProductPlan[] = [
  {
    id: 'aurafx_pro_monthly',
    tier: 'pro',
    siteTierId: 'pro',
    cadence: 'month',
    title: 'Pro monthly',
    detail: 'Maps to the site Pro tier, billed monthly. Removes ads and opens extra signal detail.',
  },
  {
    id: 'aurafx_pro_yearly',
    tier: 'pro',
    siteTierId: 'pro',
    cadence: 'year',
    title: 'Pro yearly',
    detail: 'Maps to the site Pro tier, billed yearly. Removes ads and opens extra signal detail.',
  },
  {
    id: 'aurafx_elite_monthly',
    tier: 'elite',
    siteTierId: 'elite',
    cadence: 'month',
    title: 'Elite monthly',
    detail: 'Maps to the site Elite tier, billed monthly. Removes ads and opens extra signal detail.',
  },
  {
    id: 'aurafx_elite_yearly',
    tier: 'elite',
    siteTierId: 'elite',
    cadence: 'year',
    title: 'Elite yearly',
    detail: 'Maps to the site Elite tier, billed yearly. Removes ads and opens extra signal detail.',
  },
];

export function tierForProduct(productId: string | null | undefined): PaidTier | null {
  const plan = STORE_PLANS.find((item) => item.id === productId);
  return plan ? plan.tier : null;
}
