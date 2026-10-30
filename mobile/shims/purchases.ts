/**
 * Web stand-in for react-native-purchases.
 * The native module bills through the App Store and Google Play.
 */
export const LOG_LEVEL = {
  VERBOSE: 'VERBOSE',
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

const unsupported = 'Store purchases run in the iOS and Android app.';

const Purchases = {
  setLogLevel: async () => undefined,
  configure: () => undefined,
  getProducts: async () => [],
  getCustomerInfo: async () => ({
    entitlements: { active: {} as Record<string, { productIdentifier?: string }> },
    activeSubscriptions: [] as string[],
  }),
  purchaseStoreProduct: async () => {
    throw new Error(unsupported);
  },
  restorePurchases: async () => {
    throw new Error(unsupported);
  },
  addCustomerInfoUpdateListener: () => undefined,
  removeCustomerInfoUpdateListener: () => false,
};

export default Purchases;
