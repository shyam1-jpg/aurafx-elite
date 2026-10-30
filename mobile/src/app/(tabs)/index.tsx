import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { actionOf, assetLabel, confidenceLabel, formatPrice, formatWhen, isPublished, leadLine, winText } from '../../api/format';
import type { EngineSignal } from '../../api/types';
import { AdBanner } from '../../monetization/Ads';
import { useAppState } from '../../state/AppState';
import { ActionPill, Card, EmptyBlock, ErrorBlock, LoadingBlock, SectionLabel } from '../../components/ui';
import { DISCLAIMER, colors } from '../../theme';

const FILTERS = ['All', 'Forex', 'Metals', 'Commodities', 'Published'] as const;

function matches(signal: EngineSignal, filter: (typeof FILTERS)[number]): boolean {
  if (filter === 'Published') return isPublished(signal);
  if (filter === 'Forex') return signal.asset === 'forex';
  if (filter === 'Metals') return signal.asset === 'metal';
  if (filter === 'Commodities') return signal.asset === 'commodity';
  return true;
}

export default function SignalsScreen() {
  const router = useRouter();
  const { signals, track, adsEnabled, refresh } = useAppState();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const board = signals.data;
  const list = useMemo(
    () => (board?.signals || []).filter((signal) => signal.instrument && matches(signal, filter)),
    [board, filter],
  );
  const published = list.filter(isPublished);
  const waiting = list.filter((signal) => !isPublished(signal));
  const byInstrument = track.data?.measured?.by_instrument || {};
  const disclaimer = board?.disclaimer || track.data?.disclaimer || DISCLAIMER;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={signals.status === 'loading'} onRefresh={refresh} tintColor={colors.gold} />}
      >
        <Text style={styles.brand}>AuraFX Elite</Text>
        <Text style={styles.title}>Signal point</Text>
        <Text style={styles.lede}>
          A short list of published setups. Markets that do not pass the rules stay on no-trade.
        </Text>

        {signals.status === 'loading' && !board ? <LoadingBlock label="Loading the public signal scan" /> : null}
        {signals.status === 'error' ? <ErrorBlock message={signals.error || 'The signal scan failed.'} /> : null}

        {board ? (
          <>
            <Card>
              <Text style={styles.meta}>
                {formatWhen(board.updated_at)} · {board.feed?.status || 'scan'} · {board.source || 'feed'}
              </Text>
              <Text style={styles.summary}>
                Buy {board.summary?.buy ?? 0} · Sell {board.summary?.sell ?? 0} · Wait {board.summary?.wait ?? 0} · Scanned {board.summary?.scanned ?? board.signals?.length ?? 0}
              </Text>
              {board.feed?.detail ? <Text style={styles.meta}>{board.feed.detail}</Text> : null}
              {board.price_note ? <Text style={styles.meta}>{board.price_note}</Text> : null}
            </Card>

            <View style={styles.filters}>
              {FILTERS.map((item) => (
                <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterOn]}>
                  <Text style={[styles.filterText, filter === item && styles.filterTextOn]}>{item}</Text>
                </Pressable>
              ))}
            </View>

            <SectionLabel>Published</SectionLabel>
            {published.length === 0 ? (
              <EmptyBlock
                title="No published signal"
                body={`This scan returned ${board.summary?.buy ?? 0} buys and ${board.summary?.sell ?? 0} sells. Nothing is filled in as a trade.`}
              />
            ) : (
              published.map((signal) => (
                <SignalRow
                  key={signal.instrument}
                  signal={signal}
                  measured={winText(byInstrument[signal.instrument] || track.data?.measured)}
                  onPress={() => router.push(`/signal/${signal.instrument}`)}
                />
              ))
            )}

            {filter !== 'Published' ? (
              <>
                <SectionLabel>Scanned, not published</SectionLabel>
                {waiting.length === 0 ? (
                  <EmptyBlock title="No waiting markets in this filter" body="The scan did not return a Wait row for this filter." />
                ) : (
                  waiting.map((signal) => (
                    <SignalRow
                      key={signal.instrument}
                      signal={signal}
                      measured={winText(byInstrument[signal.instrument])}
                      onPress={() => router.push(`/signal/${signal.instrument}`)}
                    />
                  ))
                )}
              </>
            ) : null}

            {track.status === 'error' ? <ErrorBlock message={track.error || 'The track record failed.'} /> : null}
            {board.publication_rule ? (
              <Card>
                <SectionLabel>Publication rule</SectionLabel>
                <Text style={styles.meta}>{board.publication_rule}</Text>
              </Card>
            ) : null}
          </>
        ) : null}

        <Text style={styles.disclaimer}>{disclaimer}</Text>
      </ScrollView>
      {adsEnabled ? <AdBanner /> : null}
    </SafeAreaView>
  );
}

function SignalRow({
  signal,
  measured,
  onPress,
}: {
  signal: EngineSignal;
  measured: string;
  onPress: () => void;
}) {
  const action = actionOf(signal);
  const confidence = confidenceLabel(signal);
  const published = isPublished(signal);
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowTitle}>
          <Text style={styles.symbol}>{signal.name || signal.instrument}</Text>
          <Text style={styles.meta}>{assetLabel(signal.asset)} · {signal.instrument} · {formatPrice(signal.instrument, signal.price)}</Text>
        </View>
        <ActionPill action={action} />
      </View>
      <Text style={styles.confidence}>{confidence.title} {confidence.value}</Text>
      {published ? (
        <Text style={styles.levels}>
          Entry {formatPrice(signal.instrument, signal.entry)} · Stop {formatPrice(signal.instrument, signal.stop_loss)} · Target {formatPrice(signal.instrument, signal.take_profit_1)}
          {signal.risk_reward != null ? ` · ${signal.risk_reward}R` : ''}
        </Text>
      ) : (
        <Text style={styles.levels}>Entry, stop and target are not published on a no-trade scan.</Text>
      )}
      {leadLine(signal) ? <Text style={styles.meta}>{leadLine(signal)}</Text> : null}
      <Text style={styles.measured}>Measured win rate · {measured}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  brand: { color: colors.gold, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  lede: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  summary: { color: colors.text, fontSize: 14, fontWeight: '600' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  filterTextOn: { color: '#1a1404' },
  row: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 6,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowTitle: { flex: 1, gap: 2 },
  symbol: { color: colors.text, fontSize: 17, fontWeight: '700' },
  confidence: { color: colors.goldSoft, fontSize: 13, fontWeight: '700' },
  levels: { color: colors.text, fontSize: 13 },
  measured: { color: colors.muted, fontSize: 12 },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
