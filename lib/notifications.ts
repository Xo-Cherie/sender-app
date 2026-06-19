import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { playDeviceCardArrivalSound } from '@/lib/deviceCardAlertSound';
import { emitDeviceNewCardAlert } from '@/lib/deviceCardAlerts';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

export type PushNotificationType = 'card_received' | 'friend_request' | 'xo_received';

export type PushNotificationData = {
  type?: PushNotificationType | string;
  cardId?: string;
  requestId?: string;
  route?: string;
  appVariant?: 'main' | 'device' | string;
};

const PUSH_TOKEN_STORAGE_KEY = 'xocherie:last-expo-push-token';
export const CARD_ARRIVAL_CHANNEL_ID = 'card-alerts';
export const CARD_ARRIVAL_SOUND = 'card_arrival';

const recentDeviceCardAlerts = new Set<string>();
const DEVICE_CARD_ALERT_DEDUPE_MS = 20_000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getAppVariant(): 'main' | 'device' {
  const variant = Constants.expoConfig?.extra?.appVariant;
  if (variant === 'device') return 'device';

  const androidPackage = Constants.expoConfig?.android?.package;
  const iosBundleId = Constants.expoConfig?.ios?.bundleIdentifier;
  if (androidPackage === 'com.xocherie.device' || iosBundleId === 'com.xocherie.device') {
    return 'device';
  }

  return 'main';
}

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function supportsRemotePushNotifications(): boolean {
  if (Platform.OS === 'web' || isExpoGo()) return false;
  return true;
}

function getEasProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId;
}

function getDeviceId(): string {
  const installationId = Constants.installationId;
  if (installationId) return installationId;

  const sessionId = Constants.sessionId;
  if (sessionId) return sessionId;

  return `${Platform.OS}-${Device.modelName || 'unknown'}`;
}

export async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#C17B66',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync(CARD_ARRIVAL_CHANNEL_ID, {
    name: 'New cards',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: '#C17B66',
    sound: CARD_ARRIVAL_SOUND,
    enableVibrate: true,
    bypassDnd: false,
  });
}

export async function alertDeviceNewCard(options: {
  cardId: string;
  title?: string;
  body?: string;
}) {
  const cardId = options.cardId.trim();
  if (!cardId || recentDeviceCardAlerts.has(cardId)) return;

  recentDeviceCardAlerts.add(cardId);
  setTimeout(() => recentDeviceCardAlerts.delete(cardId), DEVICE_CARD_ALERT_DEDUPE_MS);

  const title = options.title ?? 'New card received';
  const body = options.body ?? 'A new card has arrived on your Cherie Device';

  if (Platform.OS === 'web') {
    emitDeviceNewCardAlert({ cardId, title, body });
    return;
  }

  await ensureAndroidNotificationChannel();
  await playDeviceCardArrivalSound();

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: CARD_ARRIVAL_SOUND,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: {
          type: 'card_received',
          cardId,
          appVariant: 'device',
        },
        ...(Platform.OS === 'android' ? { channelId: CARD_ARRIVAL_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('Device card notification banner failed:', error);
  }
}

export async function requestPushPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!Device.isDevice) return false;

  await ensureAndroidNotificationChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice || !supportsRemotePushNotifications()) {
    return null;
  }

  const granted = await requestPushPermissions();
  if (!granted) return null;

  const projectId = getEasProjectId();
  if (!projectId) {
    console.warn('Missing EAS project ID; cannot register Expo push token.');
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenResponse.data || null;
}

export async function registerPushTokenForUser(_userId: string): Promise<string | null> {
  const expoPushToken = await getExpoPushToken();
  if (!expoPushToken) return null;

  const { error } = await invokeEdgeFunction('register-push-token', {
    body: {
      action: 'register',
      expoPushToken,
      platform: Platform.OS,
      appVariant: getAppVariant(),
      deviceId: getDeviceId(),
    },
  });

  if (error) {
    console.warn('Failed to register push token:', error.message || error);
    return null;
  }

  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoPushToken);
  return expoPushToken;
}

export async function unregisterPushToken(): Promise<void> {
  const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!storedToken) return;

  const { error } = await invokeEdgeFunction('register-push-token', {
    body: {
      action: 'unregister',
      expoPushToken: storedToken,
    },
  });

  if (error) {
    console.warn('Failed to unregister push token:', error.message || error);
  }

  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

export function getRouteFromNotificationData(data: PushNotificationData | undefined): string | null {
  if (!data) return null;

  if (typeof data.route === 'string' && data.route.trim()) {
    return data.route;
  }

  const appVariant = data.appVariant === 'device' || getAppVariant() === 'device' ? 'device' : 'main';

  if (data.type === 'card_received' && data.cardId) {
    return appVariant === 'device'
      ? `/device/card/${data.cardId}`
      : '/(tabs)/inbox';
  }

  if (data.type === 'xo_received' && data.cardId) {
    return appVariant === 'device'
      ? `/device/card/${data.cardId}`
      : `/card-detail?id=${data.cardId}&viewMode=sent`;
  }

  if (data.type === 'friend_request') {
    return appVariant === 'device' ? '/device/home' : '/(tabs)/friends';
  }

  return null;
}

export function parseNotificationData(
  notification: Notifications.Notification | null | undefined
): PushNotificationData | undefined {
  const raw = notification?.request?.content?.data;
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as PushNotificationData;
}
