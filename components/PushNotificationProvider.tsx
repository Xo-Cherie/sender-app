import React, { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { playDeviceCardArrivalSound, prepareDeviceCardAlertSound } from '@/lib/deviceCardAlertSound';
import {
  ensureAndroidNotificationChannel,
  getRouteFromNotificationData,
  parseNotificationData,
  registerPushTokenForUser,
} from '@/lib/notifications';

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const lastRegisteredUserIdRef = useRef<string | null>(null);
  const handledInitialNotificationRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    ensureAndroidNotificationChannel().catch((error) => {
      console.warn('Failed to configure notification channels:', error);
    });

    prepareDeviceCardAlertSound().catch((error) => {
      console.warn('Failed to prepare device card alert sound:', error);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (loading || !user?.id) {
      lastRegisteredUserIdRef.current = null;
      return;
    }

    const register = () => {
      registerPushTokenForUser(user.id)
        .then((token) => {
          if (token) {
            lastRegisteredUserIdRef.current = user.id;
          }
        })
        .catch((error) => {
          console.warn('Push token registration failed:', error);
        });
    };

    if (lastRegisteredUserIdRef.current !== user.id) {
      register();
    }

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        register();
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [loading, user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const navigateFromResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const route = getRouteFromNotificationData(parseNotificationData(response.notification));
      if (route) {
        router.push(route as any);
      }
    };

    if (!handledInitialNotificationRef.current) {
      handledInitialNotificationRef.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then(navigateFromResponse)
        .catch((error) => {
          console.warn('Could not read last notification response:', error);
        });
    }

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = parseNotificationData(notification);
      if (data?.type === 'card_received') {
        playDeviceCardArrivalSound().catch((error) => {
          console.warn('Foreground card alert sound failed:', error);
        });
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromResponse(response);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [router]);

  return <>{children}</>;
}
