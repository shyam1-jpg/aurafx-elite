import { useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PricingTier } from '../../api/types';
import { AdBanner } from '../../monetization/Ads';
import { PRODUCT_IDS, STORE_PLANS } from '../../monetization/products';
import { useAppState } from '../../state/AppState';
import { Card, ErrorBlock, LoadingBlock, SectionLabel } from '../../components/ui';
import { DISCLAIMER, colors } from '../../theme';

export default function AccountScreen() {
  const { pricing, tier, adsEnabled, billingDetail, storeProducts, purchase, restore, refresh } = useAppState();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const payload = pricing.data;
  const symbol = payload?.currency_symbol || '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={pricing.status === 'loading'} onRefresh={refresh} tintColor={colors.gold} />}
      >
        <Text style={styles.brand}>AuraFX Elite</Text>
        <Text style={styles.title}>Upgrade</Text>
        <Text style={styles.lede}>
          Free keeps the public scan and shows ads. Pro and Elite remove ads and open extra signal detail without a rewarded ad. Analysis only. Auto trading stays off.
        </Text>

        <Card>
          <SectionLabel>This install</SectionLabel>
          <Text style={styles.plan}>{tier === 'elite' ? 'Elite' : tier === 'pro' ? 'Pro' : 'Free'}</Text>
          <Text style={styles.meta}>{tier ? 'Ads are off.' : 'Ads are on.'}</Text>
          <Text style={styles.meta}>{billingDetail}</Text>
        </Card>

        {pricing.status === 'loading' && !payload ? <LoadingBlock label="Loading /api/pricing" /> : null}
        {pricing.status === 'error' ? <ErrorBlock message={pricing.error || 'Pricing failed to load.'} /> : null}
        {payload?.note ? <Text style={styles.meta}>{payload.note}</Text> : null}

        {STORE_PLANS.map((plan) => {
          const site = (payload?.tiers || []).find((item) => item.id === plan.siteTierId);
          const store = storeProducts.find((item) => item.identifier === plan.id);
          return (
            <Card key={plan.id}>
              <SectionLabel>{plan.title}</SectionLabel>
              <Text style={styles.productId}>{plan.id}</Text>
              <Text style={styles.price}>{priceLine(site, plan.cadence, symbol, store?.priceString)}</Text>
              <Text style={styles.meta}>{plan.detail}</Text>
              {(site?.features || []).map((feature) => (
                <Text key={feature} style={styles.feature}>· {feature}</Text>
              ))}
              {!site && payload ? <Text style={styles.meta}>The pricing response did not include the {plan.siteTierId} tier.</Text> : null}
              <Pressable
                style={[styles.button, (busy || Platform.OS === 'web') && styles.buttonOff]}
                disabled={busy || Platform.OS === 'web' || !store}
                onPress={async () => {
                  if (!store) return;
                  setBusy(true);
                  setMessage(null);
                  const error = await purchase(store);
                  setMessage(error);
                  setBusy(false);
                }}
              >
                <Text style={styles.buttonText}>
                  {Platform.OS === 'web' ? 'Store purchase runs on device' : store ? 'Subscribe' : 'Waiting for the store product'}
                </Text>
              </Pressable>
            </Card>
          );
        })}

        <Pressable
          style={styles.secondary}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setMessage(await restore());
            setBusy(false);
          }}
        >
          <Text style={styles.secondaryText}>Restore purchases</Text>
        </Pressable>
        {message ? <Text style={styles.meta}>{message}</Text> : null}

        <Card>
          <SectionLabel>Product ids</SectionLabel>
          <Text style={styles.meta}>{PRODUCT_IDS.join(' · ')}</Text>
          <Text style={styles.meta}>
            These are placeholders until the App Store and Play Console products exist. A missing RevenueCat key does not unlock a paid tier.
          </Text>
        </Card>
        <Text style={styles.disclaimer}>{payload ? DISCLAIMER : DISCLAIMER}</Text>
      </ScrollView>
      {adsEnabled ? <AdBanner /> : null}
    </SafeAreaView>
  );
}

function priceLine(
  tier: PricingTier | undefined,
  cadence: 'month' | 'year',
  symbol: string,
  storePrice: string | undefined,
): string {
  if (storePrice) return `${storePrice} from the store`;
  if (!tier) return 'Site price unavailable';
  if (cadence === 'year') {
    if (tier.annual_price == null) return 'Yearly site price unavailable';
    return `${symbol}${tier.annual_price} / ${tier.annual_period || 'year'} on the site`;
  }
  if (tier.price == null) return 'Monthly site price unavailable';
  return `${symbol}${tier.price} / ${tier.period || 'month'} on the site`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  brand: { color: colors.gold, fontWeight: '700' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  lede: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  plan: { color: colors.goldSoft, fontSize: 28, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  productId: { color: colors.text, fontSize: 13, fontWeight: '700' },
  price: { color: colors.text, fontSize: 18, fontWeight: '700' },
  feature: { color: colors.text, fontSize: 13, lineHeight: 18 },
  button: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  buttonOff: { opacity: 0.55 },
  buttonText: { color: '#1a1404', fontWeight: '800' },
  secondary: { alignItems: 'center', paddingVertical: 8 },
  secondaryText: { color: colors.gold, fontWeight: '700' },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
