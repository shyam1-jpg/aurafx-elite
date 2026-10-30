import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { AppStateProvider } from '../state/AppState';
import { colors } from '../theme';

function NotificationBridge() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const instrument = response.notification.request.content.data?.instrument;
      if (typeof instrument === 'string' && /^[A-Z0-9]{3,12}$/.test(instrument)) {
        router.push(`/signal/${instrument}`);
      }
    });
    return () => subscription.remove();
  }, [router]);
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style="light" />
        <NotificationBridge />
        <View style={styles.frame}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.gold,
              headerTitleStyle: { color: colors.text },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="signal/[instrument]" options={{ title: 'Signal' }} />
          </Stack>
        </View>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: colors.bg,
    ...(Platform.OS === 'web'
      ? { maxWidth: 430, width: '100%', alignSelf: 'center' }
      : null),
  },
});
