import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MobileAds, { BannerAd, BannerAdSize, TestIds, useRewardedAd } from 'react-native-google-mobile-ads';

import { colors } from '../theme';

const WEB_BANNER = 'ca-app-pub-3940256099942544/6300978111';
const WEB_REWARDED = 'ca-app-pub-3940256099942544/5224354917';

let started = false;

export function prepareAds(): void {
  if (Platform.OS === 'web' || started) return;
  started = true;
  MobileAds()
    .initialize()
    .catch(() => {
      started = false;
    });
}

export function AdBanner() {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.banner} accessibilityRole="text">
        <Text style={styles.kicker}>Test ad</Text>
        <Text style={styles.unit}>Banner · {WEB_BANNER}</Text>
      </View>
    );
  }
  return (
    <View style={styles.nativeBanner}>
      <BannerAd
        unitId={TestIds.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

export function RewardedDetailButton({
  onUnlocked,
}: {
  onUnlocked: () => void;
}) {
  const rewarded = useRewardedAd({ adUnitId: TestIds.REWARDED });

  useEffect(() => {
    if (rewarded.earnedReward) onUnlocked();
  }, [onUnlocked, rewarded.earnedReward]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.rewardBox}>
        <Text style={styles.rewardTitle}>Extra detail stays locked in this preview</Text>
        <Text style={styles.rewardBody}>
          The iOS and Android builds request Google&apos;s rewarded test unit {WEB_REWARDED}. Watching it unlocks the factor notes for that signal. This web preview does not grant the unlock.
        </Text>
      </View>
    );
  }

  const busy = rewarded.status === 'loading' || rewarded.status === 'showing';
  const label =
    rewarded.status === 'loaded'
      ? 'Watch a test ad to unlock detail'
      : rewarded.status === 'loading'
        ? 'Loading test ad…'
        : rewarded.status === 'error' || rewarded.status === 'no-fill'
          ? 'Retry the test ad'
          : 'Load a test ad';

  return (
    <View style={styles.rewardBox}>
      <Pressable
        style={styles.rewardButton}
        disabled={busy}
        onPress={() => {
          if (rewarded.status === 'loaded') rewarded.show();
          else if (rewarded.status === 'error' || rewarded.status === 'no-fill') rewarded.retry();
          else rewarded.load();
        }}
      >
        <Text style={styles.rewardButtonText}>{label}</Text>
      </Pressable>
      <Text style={styles.rewardBody}>
        Google test unit {TestIds.REWARDED}. A completed view unlocks the factor notes for this signal only.
      </Text>
      {rewarded.error ? <Text style={styles.rewardError}>{rewarded.error.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#0e1320',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  nativeBanner: {
    alignItems: 'center',
    marginBottom: 8,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  unit: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  rewardBox: {
    gap: 8,
  },
  rewardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rewardBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  rewardButton: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rewardButtonText: {
    color: '#1a1404',
    fontWeight: '700',
    fontSize: 14,
  },
  rewardError: {
    color: colors.sell,
    fontSize: 12,
  },
});
