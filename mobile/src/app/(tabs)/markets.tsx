import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MarketRow } from '../../api/types';
import { AdBanner } from '../../monetization/Ads';
import { useAppState } from '../../state/AppState';
import { Card, EmptyBlock, ErrorBlock, LoadingBlock, SectionLabel } from '../../components/ui';
import { colors } from '../../theme';

type Group = { title: string; rows: MarketRow[] };

function displayPrice(row: MarketRow): string | null {
  if (typeof row.price === 'string' && row.price && row.price !== '—') return row.price;
  if (typeof row.spotPrice === 'string' && row.spotPrice && row.spotPrice !== '—') return row.spotPrice;
  return null;
}

export default function MarketsScreen() {
  const { markets, watchlist, toggleWatch, adsEnabled, refresh } = useAppState();
  const [onlyWatch, setOnlyWatch] = useState(false);
  const payload = markets.data;
  const groups = useMemo<Group[]>(() => {
    if (!payload) return [];
    return [
      { title: 'Forex majors', rows: payload.forex?.majors || [] },
      { title: 'Forex minors', rows: payload.forex?.minors || [] },
      { title: 'Forex exotics', rows: payload.forex?.exotics || [] },
      { title: 'Metals', rows: payload.metals || [] },
      { title: 'Energy', rows: payload.energy || [] },
      { title: 'Agriculture', rows: payload.ag || [] },
    ].filter((group) => group.rows.length > 0);
  }, [payload]);

  const watchedRows = watchlist.map((symbol) => {
    for (const group of groups) {
      const found = group.rows.find((row) => row.symbol === symbol);
      if (found) return found;
    }
    return { symbol, live: false } satisfies MarketRow;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={markets.status === 'loading'} onRefresh={refresh} tintColor={colors.gold} />}
      >
        <Text style={styles.brand}>AuraFX Elite</Text>
        <Text style={styles.title}>Markets</Text>
        <Text style={styles.lede}>Live quotes for forex, metals and commodities. A star saves a symbol on this device.</Text>

        {markets.status === 'loading' && !payload ? <LoadingBlock label="Loading /api/markets" /> : null}
        {markets.status === 'error' ? <ErrorBlock message={markets.error || 'Markets failed to load.'} /> : null}

        {payload ? (
          <Card>
            <Text style={styles.meta}>{payload.live ? 'Live' : 'Not live'} · {payload.source || 'Source unavailable'}</Text>
            {payload.updatedAt ? <Text style={styles.meta}>{payload.updatedAt}</Text> : null}
            {payload.disclaimer ? <Text style={styles.meta}>{payload.disclaimer}</Text> : null}
          </Card>
        ) : null}

        <View style={styles.filters}>
          <Pressable onPress={() => setOnlyWatch(false)} style={[styles.filter, !onlyWatch && styles.filterOn]}>
            <Text style={[styles.filterText, !onlyWatch && styles.filterTextOn]}>All</Text>
          </Pressable>
          <Pressable onPress={() => setOnlyWatch(true)} style={[styles.filter, onlyWatch && styles.filterOn]}>
            <Text style={[styles.filterText, onlyWatch && styles.filterTextOn]}>Watchlist {watchlist.length}</Text>
          </Pressable>
        </View>

        <SectionLabel>Watchlist</SectionLabel>
        {watchlist.length === 0 ? (
          <EmptyBlock title="Nothing saved" body="Star a market to keep it here. Prices are not stored separately from the latest response." />
        ) : (
          watchedRows.map((row) => (
            <MarketLine key={`watch-${row.symbol}`} row={row} saved onToggle={() => row.symbol && toggleWatch(row.symbol)} missingPrice={!displayPrice(row)} />
          ))
        )}

        {!onlyWatch && groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <SectionLabel>{group.title}</SectionLabel>
            {group.rows.map((row) => (
              <MarketLine
                key={`${group.title}-${row.symbol}`}
                row={row}
                saved={!!row.symbol && watchlist.includes(row.symbol)}
                onToggle={() => row.symbol && toggleWatch(row.symbol)}
                missingPrice={!displayPrice(row)}
              />
            ))}
          </View>
        ))}

        {payload && groups.length === 0 ? (
          <EmptyBlock title="No market rows" body="The markets response did not include forex, metals or commodity lists." />
        ) : null}
      </ScrollView>
      {adsEnabled ? <AdBanner /> : null}
    </SafeAreaView>
  );
}

function MarketLine({
  row,
  saved,
  onToggle,
  missingPrice,
}: {
  row: MarketRow;
  saved: boolean;
  onToggle: () => void;
  missingPrice: boolean;
}) {
  const price = displayPrice(row);
  const change = row.dailyChange && row.dailyChange !== '—' ? row.dailyChange : null;
  const tone = row.trend === 'Bullish' ? styles.up : row.trend === 'Bearish' ? styles.down : styles.flat;
  return (
    <View style={styles.line}>
      <View style={styles.lineCopy}>
        <Text style={styles.symbol}>{row.symbol || 'Unknown'}</Text>
        <Text style={styles.meta}>
          {missingPrice ? 'Price missing from this response' : price}
          {change ? ` · ${change}` : ''}
          {row.trend ? ` · ${row.trend}` : ''}
        </Text>
      </View>
      <Text style={[styles.change, tone]}>{change || '—'}</Text>
      <Pressable onPress={onToggle} style={styles.star} accessibilityRole="button" accessibilityLabel={saved ? 'Remove from watchlist' : 'Add to watchlist'}>
        <Text style={saved ? styles.starOn : styles.starOff}>{saved ? '★' : '☆'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  brand: { color: colors.gold, fontWeight: '700' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  lede: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  filters: { flexDirection: 'row', gap: 8 },
  filter: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 6 },
  filterOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  filterTextOn: { color: '#1a1404' },
  group: { gap: 8 },
  line: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineCopy: { flex: 1, gap: 2 },
  symbol: { color: colors.text, fontWeight: '700', fontSize: 15 },
  change: { fontSize: 12, fontWeight: '700', minWidth: 64, textAlign: 'right' },
  up: { color: colors.buy },
  down: { color: colors.sell },
  flat: { color: colors.gold },
  star: { paddingHorizontal: 4 },
  starOn: { color: colors.gold, fontSize: 20 },
  starOff: { color: colors.muted, fontSize: 20 },
});
