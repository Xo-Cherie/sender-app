import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/constants/theme';

export default function DeviceIndex() {
  const { user, loading, checkMfaRequired } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    async function routeDevice() {
      if (user) {
        if (await checkMfaRequired()) {
          router.replace({ pathname: '/device/mfa-verify', params: { next: '/device/home' } });
        } else {
          router.replace('/device/home');
        }
      } else {
        router.replace('/device/login');
      }
    }

    routeDevice();
  }, [user, loading, router, checkMfaRequired]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.cream, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}
