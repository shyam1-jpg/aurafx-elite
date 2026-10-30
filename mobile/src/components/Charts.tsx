import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';

import type { CandleBar, EquityPoint } from '../api/types';
import { colors } from '../theme';

export function EquityChart({ points }: { points: EquityPoint[] }) {
  const [width, setWidth] = useState(320);
  const series = points.length ? points : [];
  if (!series.length) {
    return <Text style={styles.note}>The track record did not include an equity curve.</Text>;
  }
  const height = 140;
  const pad = 8;
  const values = series.map((point) => Number(point.equity_r) || 0);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const step = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 0;
  const coords = series
    .map((point, index) => {
      const x = pad + index * step;
      const y = pad + ((max - (Number(point.equity_r) || 0)) / span) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  const zeroY = pad + ((max - 0) / span) * (height - pad * 2);
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Svg width={width} height={height}>
        <Line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="rgba(139,144,165,0.45)" strokeWidth={1} />
        <Polyline points={coords} fill="none" stroke={colors.gold} strokeWidth={2} />
      </Svg>
      <Text style={styles.note}>
        {series.length === 1
          ? 'One measured point from the track record.'
          : `${series.length} measured points, in R.`}
      </Text>
    </View>
  );
}

export function CandleChart({ bars }: { bars: CandleBar[] }) {
  const [width, setWidth] = useState(320);
  if (!bars.length) return null;
  const height = 180;
  const pad = 8;
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = max - min || 1;
  const slot = (width - pad * 2) / bars.length;
  const bodyWidth = Math.max(2, slot * 0.55);
  const yFor = (value: number) => pad + ((max - value) / span) * (height - pad * 2);
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Svg width={width} height={height}>
        {bars.map((bar, index) => {
          const x = pad + index * slot + slot / 2;
          const color = bar.close >= bar.open ? colors.buy : colors.sell;
          return (
            <Line
              key={`wick-${bar.time}-${index}`}
              x1={x}
              x2={x}
              y1={yFor(bar.high)}
              y2={yFor(bar.low)}
              stroke={color}
              strokeWidth={1}
            />
          );
        })}
        {bars.map((bar, index) => {
          const x = pad + index * slot + (slot - bodyWidth) / 2;
          const up = bar.close >= bar.open;
          const color = up ? colors.buy : colors.sell;
          const openY = yFor(bar.open);
          const closeY = yFor(bar.close);
          const top = Math.min(openY, closeY);
          const body = Math.max(1, Math.abs(closeY - openY));
          return (
            <Rect
              key={`body-${bar.time}-${index}`}
              x={x}
              y={top}
              width={bodyWidth}
              height={body}
              fill={color}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
});
