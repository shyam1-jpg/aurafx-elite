import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.gold} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorTitle}>Could not load this</Text>
      <Text style={styles.errorBody}>{message}</Text>
    </View>
  );
}

export function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
    </View>
  );
}

export function ActionPill({ action }: { action: string }) {
  const tone = action === 'BUY' ? styles.buy : action === 'SELL' ? styles.sell : styles.wait;
  return (
    <View style={[styles.pill, tone]}>
      <Text style={styles.pillText}>{action === 'WAIT' ? 'NO TRADE' : action}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 8,
  },
  section: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  center: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
  },
  errorBox: {
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.35)',
    padding: 14,
    gap: 6,
  },
  errorTitle: {
    color: colors.sell,
    fontWeight: '700',
    fontSize: 15,
  },
  errorBody: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    color: colors.goldSoft,
    fontSize: 16,
    fontWeight: '700',
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    color: '#0a0c12',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  buy: { backgroundColor: colors.buy },
  sell: { backgroundColor: colors.sell },
  wait: { backgroundColor: colors.gold },
});
