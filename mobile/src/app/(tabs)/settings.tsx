import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { registerForSignalPushes, type PushRegistration } from '../../notifications/setup';
import { useAppState } from '../../state/AppState';
import { Card, ErrorBlock, LoadingBlock, SectionLabel } from '../../components/ui';
import { DISCLAIMER, PRIVACY_URL, RISK_URL, SUPPORT_EMAIL, TERMS_URL, colors } from '../../theme';

export default function SettingsScreen() {
  const { plans, signals } = useAppState();
  const [push, setPush] = useState<PushRegistration | null>(null);
  const [busy, setBusy] = useState(false);
  const risk = plans.data?.risk;
  const disclaimer = signals.data?.disclaimer || plans.data?.disclaimer || DISCLAIMER;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>AuraFX Elite</Text>
        <Text style={styles.title}>Settings</Text>

        <Card>
          <SectionLabel>Risk warning</SectionLabel>
          <Text style={styles.body}>{disclaimer}</Text>
          <Text style={styles.meta}>Signals are analysis. They are not orders, and auto trading is off.</Text>
          <LinkRow label="Risk warning on the site" url={RISK_URL} />
        </Card>

        <Card>
          <SectionLabel>Risk defaults</SectionLabel>
          {plans.status === 'loading' && !plans.data ? <LoadingBlock label="Loading /api/signals/plans" /> : null}
          {plans.status === 'error' ? <ErrorBlock message={plans.error || 'Risk defaults failed to load.'} /> : null}
          {risk ? (
            <>
              <Text style={styles.body}>Risk per trade {risk.per_trade_pct ?? '—'}%</Text>
              <Text style={styles.body}>Max daily loss {risk.max_daily_loss_pct ?? '—'}%</Text>
              <Text style={styles.body}>Max weekly loss {risk.max_weekly_loss_pct ?? '—'}%</Text>
              <Text style={styles.body}>Max open trades {risk.max_open_trades ?? '—'}</Text>
              <Text style={styles.body}>Auto trading {risk.auto_trading || '—'}</Text>
              {risk.note ? <Text style={styles.meta}>{risk.note}</Text> : null}
            </>
          ) : null}
        </Card>

        <Card>
          <SectionLabel>Signal alerts</SectionLabel>
          <Text style={styles.meta}>
            Permission and an Expo push token can be registered here. This prototype does not send a notification and does not invent a token.
          </Text>
          <Pressable
            style={styles.button}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setPush(await registerForSignalPushes());
              setBusy(false);
            }}
          >
            <Text style={styles.buttonText}>{busy ? 'Checking…' : 'Register this device'}</Text>
          </Pressable>
          {push ? (
            <>
              <Text style={styles.body}>Status {push.status}</Text>
              <Text style={styles.meta}>{push.detail}</Text>
              {push.token ? <Text style={styles.token}>{push.token}</Text> : null}
            </>
          ) : null}
        </Card>

        <Card>
          <SectionLabel>Privacy and support</SectionLabel>
          <LinkRow label="Privacy policy" url={PRIVACY_URL} />
          <LinkRow label="Terms" url={TERMS_URL} />
          <LinkRow label={SUPPORT_EMAIL} url={`mailto:${SUPPORT_EMAIL}`} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  brand: { color: colors.gold, fontWeight: '700' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  link: { color: colors.gold, fontSize: 15, fontWeight: '700', paddingVertical: 4 },
  button: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#1a1404', fontWeight: '800' },
  token: { color: colors.text, fontSize: 12 },
});
