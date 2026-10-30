import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type PushRegistration = {
  status: string;
  token: string | null;
  detail: string;
};

let handlerReady = false;

export function setupNotificationHandler(): void {
  if (handlerReady || Platform.OS === 'web') return;
  handlerReady = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function registerForSignalPushes(): Promise<PushRegistration> {
  if (Platform.OS === 'web') {
    return {
      status: 'unavailable',
      token: null,
      detail: 'Push registration runs on iOS and Android. This preview cannot issue an Expo push token.',
    };
  }
  setupNotificationHandler();
  if (!Device.isDevice) {
    return {
      status: 'simulator',
      token: null,
      detail: 'A physical device is required before Expo can issue a push token.',
    };
  }
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    return {
      status,
      token: null,
      detail: 'Notification permission was not granted.',
    };
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('signals', {
      name: 'Signals',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const projectId =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return {
      status: 'granted',
      token: null,
      detail: 'Permission is granted. An Expo push token needs an EAS project id, which this prototype does not have yet. No notification was sent.',
    };
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return {
      status: 'granted',
      token: token.data,
      detail: 'This device can receive a push. The server does not send signal pushes from this build yet.',
    };
  } catch (error) {
    return {
      status: 'error',
      token: null,
      detail: error instanceof Error ? error.message : 'Push registration failed.',
    };
  }
}
