import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError, getCandles, getTrackRecord } from '../../api/client';
import {
  actionOf,
  assetLabel,
  averageRText,
  confidenceLabel,
  drawdownText,
  formatPrice,
  isPublished,
  profitFactorText,
  winText,
} from '../../api/format';
import type { CandlePayload, EngineSignal, TrackRecord } from '../../api/types';
import { CandleChart, EquityChart } from '../../components/Charts';
import { ActionPill, Card, EmptyBlock, ErrorBlock, LoadingBlock, SectionLabel } from '../../components/ui';
import { AdBanner, RewardedDetailButton } from '../../monetization/Ads';
import { useAppState } from '../../state/AppState';
import { DISCLAIMER, colors } from '../../theme';

export default function SignalDetailScreen() {
  const params = useLocalSearchParams<{ instrument: string }>();
  const instrument = String(params.instrument || '').toUpperCase();
  const { signals, adsEnabled, detailOpen, unlockDetail } = useAppState();
  const signal = (signals.data?.signals || []).find((item) => item.instrument === instrument) || null;
  const [track, setTrack] = useState<TrackRecord | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [candles, setCandles] = useState<CandlePayload | null>(null);
  const [candleError, setCandleError] = useState<string | null>(null);
  const [candleLoading, setCandleLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setTrack(null);
    setTrackError(null);
    setCandles(null);
    setCandleError(null);
    setCandleLoading(true);
    getTrackRecord(instrument)
      .then((record) => {
        if (active) setTrack(record);
      })
      .catch((error: unknown) => {
        if (active) setTrackError(error instanceof Error ? error.message : 'Track record failed.');
      });
    getCandles(instrument)
      .then((payload) => {
        if (!active) return;
        setCandles(payload);
        if (payload.available === false) {
          setCandleError(payload.note || payload.error || 'Candle history was not returned.');
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof ApiError ? error.message : 'Candle history could not be loaded.';
        setCandleError(message);
      })
      .finally(() => {
        if (active) setCandleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [instrument]);

  const open = detailOpen(instrument);
  const disclaimer = signal?.disclaimer || track?.disclaimer || signals.data?.disclaimer || DISCLAIMER;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: signal?.name || instrument || 'Signal' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {!instrument ? <ErrorBlock message="This screen needs an instrument id." /> : null}
        {signals.status === 'loading' && !signal ? <LoadingBlock label="Loading the scan" /> : null}
        {signals.status === 'error' && !signal ? <ErrorBlock message={signals.error || 'The scan failed.'} /> : null}
        {signals.status === 'ready' && !signal ? (
          <EmptyBlock title="Not in this scan" body={`${instrument} was not in the latest /api/signals response.`} />
        ) : null}
        {signal ? <DetailBody signal={signal} track={track} trackError={trackError} candles={candles} candleError={candleError} candleLoading={candleLoading} open={open} onUnlock={() => unlockDetail(instrument)} /> : null}
        <Text style={styles.disclaimer}>{disclaimer}</Text>
      </ScrollView>
      {adsEnabled ? <AdBanner /> : null}
    </View>
  );
}

function DetailBody({
  signal,
  track,
  trackError,
  candles,
  candleError,
  candleLoading,
  open,
  onUnlock,
}: {
  signal: EngineSignal;
  track: TrackRecord | null;
  trackError: string | null;
  candles: CandlePayload | null;
  candleError: string | null;
  candleLoading: boolean;
  open: boolean;
  onUnlock: () => void;
}) {
  const action = actionOf(signal);
  const confidence = confidenceLabel(signal);
  const measured = track?.measured;
  const published = isPublished(signal);
  const bars = Array.isArray(candles?.bars) ? candles.bars.filter(isBar) : [];
  return (
    <>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.name}>{signal.name || signal.instrument}</Text>
          <Text style={styles.meta}>{assetLabel(signal.asset)} · {signal.timeframe || 'H1'} · {signal.session || 'Session unavailable'}</Text>
        </View>
        <ActionPill action={action} />
      </View>

      <Card>
        <SectionLabel>Levels</SectionLabel>
        <View style={styles.grid}>
          <Level label="Price" value={formatPrice(signal.instrument, signal.price)} />
          <Level label="Entry" value={published ? formatPrice(signal.instrument, signal.entry) : '—'} />
          <Level label="Stop" value={published ? formatPrice(signal.instrument, signal.stop_loss) : '—'} />
          <Level label="Target" value={published ? formatPrice(signal.instrument, signal.take_profit_1) : '—'} />
          <Level label="Target 2" value={published ? formatPrice(signal.instrument, signal.take_profit_2) : '—'} />
          <Level label="Risk / reward" value={published && signal.risk_reward != null ? `${signal.risk_reward}R` : '—'} />
        </View>
        {!published ? <Text style={styles.meta}>No entry, stop or target is published while the action is no-trade.</Text> : null}
        {signal.feed_stale ? <Text style={styles.warn}>The scan flagged this feed as stale.</Text> : null}
        {signal.feed_note ? <Text style={styles.meta}>{signal.feed_note}</Text> : null}
      </Card>

      <Card>
        <SectionLabel>Confidence</SectionLabel>
        <Text style={styles.score}>{confidence.value}</Text>
        <Text style={styles.meta}>{confidence.note}</Text>
      </Card>

      <Card>
        <SectionLabel>Chart</SectionLabel>
        {candleLoading ? <LoadingBlock label="Requesting hourly candles" /> : null}
        {bars.length ? <CandleChart bars={bars} /> : null}
        {!candleLoading && bars.length === 0 ? (
          <EmptyBlock
            title="No price bars"
            body={candleError || candles?.note || 'The candle endpoint did not return bars. This screen does not draw stand-in prices.'}
          />
        ) : null}
        {candles?.note && bars.length ? <Text style={styles.meta}>{candles.note}</Text> : null}
      </Card>

      <Card>
        <SectionLabel>Measured stats</SectionLabel>
        {trackError ? <ErrorBlock message={trackError} /> : null}
        {!track && !trackError ? <LoadingBlock label="Loading the track record" /> : null}
        {track ? (
          <>
            <View style={styles.grid}>
              <Level label="Win rate" value={winText(measured)} />
              <Level label="Average R" value={averageRText(measured)} />
              <Level label="Profit factor" value={profitFactorText(measured)} />
              <Level label="Max drawdown" value={drawdownText(measured)} />
            </View>
            {measured?.win_rate_basis ? <Text style={styles.meta}>{measured.win_rate_basis}</Text> : null}
            {track.basis ? <Text style={styles.meta}>{track.basis}</Text> : null}
            <EquityChart points={track.equity || []} />
            <Text style={styles.meta}>A separate historical backtest file is not published by the API. These figures are the measured track record only.</Text>
          </>
        ) : null}
      </Card>

      <Card>
        <SectionLabel>Setup detail</SectionLabel>
        {open ? (
          <>
            {(signal.blockers || []).length ? (
              signal.blockers?.map((line) => <Text key={line} style={styles.meta}>{line}</Text>)
            ) : null}
            {signal.rationale ? <Text style={styles.body}>{signal.rationale}</Text> : <Text style={styles.meta}>The scan did not include a rationale.</Text>}
            <View style={styles.grid}>
              <Level label="Support" value={formatPrice(signal.instrument, signal.support)} />
              <Level label="Resistance" value={formatPrice(signal.instrument, signal.resistance)} />
              <Level label="RSI" value={signal.rsi == null ? '—' : String(signal.rsi)} />
              <Level label="ATR" value={formatPrice(signal.instrument, signal.atr)} />
            </View>
            {(signal.factors || []).map((factor) => (
              <View key={factor.key || factor.label} style={styles.factor}>
                <Text style={styles.factorLabel}>{factor.label || factor.key} · {factor.state || '—'}</Text>
                {factor.note ? <Text style={styles.meta}>{factor.note}</Text> : null}
              </View>
            ))}
            {signal.regime_note ? <Text style={styles.meta}>{signal.regime_note}</Text> : null}
          </>
        ) : (
          <RewardedDetailButton onUnlocked={onUnlock} />
        )}
      </Card>
    </>
  );
}

function isBar(value: unknown): value is { time: number; open: number; high: number; low: number; close: number } {
  if (!value || typeof value !== 'object') return false;
  const bar = value as Record<string, unknown>;
  return [bar.time, bar.open, bar.high, bar.low, bar.close].every((item) => typeof item === 'number' && Number.isFinite(item));
}

function Level({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.level}>
      <Text style={styles.levelLabel}>{label}</Text>
      <Text style={styles.levelValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  titleCopy: { flex: 1, gap: 4 },
  name: { color: colors.text, fontSize: 26, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  score: { color: colors.goldSoft, fontSize: 32, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  level: { width: '47%', gap: 2 },
  levelLabel: { color: colors.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  levelValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  warn: { color: colors.sell, fontSize: 13 },
  factor: { gap: 2, paddingTop: 4 },
  factorLabel: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
