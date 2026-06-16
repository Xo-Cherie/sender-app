import React, { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  getRouteFromNotificationData,
  parseNotificationData,
  registerPushTokenForUser,
  type PushNotificationData,
} from '@/lib/notifications';

function navigateFromNotificationData(
  router: ReturnType<typeof useRouter>,
  data: PushNotificationData | undefined
) {
  if (!data) return;

  if (data.type === 'xo_received' && data.cardId) {
    router.push({
      pathname: '/card-detail',
      params: { id: data.cardId, viewMode: 'sent' },
    });
    return;
  }

  if (data.type === 'card_received' && data.cardId) {
    const appVariant = data.appVariant === 'device' ? 'device' : 'main';
    if (appVariant === 'device') {
      router.push(`/device/card/${data.cardId}` as any);
      return;
    }
    router.push('/(tabs)/inbox' as any);
    return;
  }

  const route = getRouteFromNotificationData(data);
  if (route) {
    router.push(route as any);
  }
}

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const lastRegisteredUserIdRef = useRef<string | null>(null);
  const handledInitialNotificationRef = useRef(false);

  useEffect(() => {
    if (loading || !user?.id) {
      lastRegisteredUserIdRef.current = null;
      return;
    }

    if (lastRegisteredUserIdRef.current === user.id) return;

    registerPushTokenForUser(user.id)
      .then(() => {
        lastRegisteredUserIdRef.current = user.id;
      })
      .catch((error) => {
        console.warn('Push token registration failed:', error);
      });
  }, [loading, user?.id]);

  useEffect(() => {
    const navigateFromResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      navigateFromNotificationData(router, parseNotificationData(response.notification));
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
      console.log('Push notification received in foreground:', notification.request.identifier);
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
