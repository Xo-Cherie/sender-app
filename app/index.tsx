import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';
import { theme } from '@/constants/theme';

export default function Index() {
  const router = useRouter();
  const { user, loading, checkMfaRequired } = useAuth();

  useEffect(() => {
    if (loading) return;

    const checkOnboarding = async () => {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        
        if (!hasSeenOnboarding) {
          router.replace('/onboarding');
        } else if (!user) {
          router.replace('/login');
        } else if (await checkMfaRequired()) {
          router.replace({ pathname: '/mfa-verify', params: { next: '/(tabs)' } });
        } else {
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        router.replace('/onboarding');
      }
    };

    checkOnboarding();
  }, [router, user, loading, checkMfaRequired]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.cream,
  },
});
