import { Tabs } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../../theme';

function TabIcon({ name, color }: { name: 'signals' | 'markets' | 'upgrade' | 'settings'; color: string }) {
  const stroke = color || colors.gold;
  if (name === 'signals') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M4 16l4-6 3 3 5-8 4 6" stroke={stroke} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    );
  }
  if (name === 'markets') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Rect x={3} y={4} width={7} height={7} rx={1.5} stroke={stroke} strokeWidth={1.6} fill="none" />
        <Rect x={14} y={4} width={7} height={7} rx={1.5} stroke={stroke} strokeWidth={1.6} fill="none" />
        <Rect x={3} y={14} width={7} height={6} rx={1.5} stroke={stroke} strokeWidth={1.6} fill="none" />
        <Rect x={14} y={14} width={7} height={6} rx={1.5} stroke={stroke} strokeWidth={1.6} fill="none" />
      </Svg>
    );
  }
  if (name === 'upgrade') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={8} stroke={stroke} strokeWidth={1.6} fill="none" />
        <Path d="M12 8v8M9 11l3-3 3 3" stroke={stroke} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={3} stroke={stroke} strokeWidth={1.6} fill="none" />
      <Path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.lineSoft,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Signals', tabBarIcon: ({ color }) => <TabIcon name="signals" color={String(color ?? colors.gold)} /> }} />
      <Tabs.Screen name="markets" options={{ title: 'Markets', tabBarIcon: ({ color }) => <TabIcon name="markets" color={String(color ?? colors.gold)} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Upgrade', tabBarIcon: ({ color }) => <TabIcon name="upgrade" color={String(color ?? colors.gold)} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <TabIcon name="settings" color={String(color ?? colors.gold)} /> }} />
    </Tabs>
  );
}
