import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { establishSessionFromAuthUrl } from '@/lib/parseAuthCallbackUrl';
import { theme } from '@/constants/theme';

async function getIncomingAuthUrl(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.href;
  }
  return Linking.getInitialURL();
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeAuth(incomingUrl: string | null) {
      try {
        if (!incomingUrl) {
          throw new Error('Sign-in link expired or is invalid. Request a new link and try again.');
        }

        let isRecovery = false;
        const hasAuthPayload =
          incomingUrl.includes('code=') ||
          incomingUrl.includes('access_token=') ||
          incomingUrl.includes('error=');

        if (hasAuthPayload) {
          const result = await establishSessionFromAuthUrl(incomingUrl);
          isRecovery = result.isRecovery;
        }

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, '/auth/callback');
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Sign-in link expired or is invalid. Request a new link and try again.');
        }

        if (!cancelled) {
          if (isRecovery) {
            router.replace('/reset-password' as '/login');
          } else {
            router.replace('/(tabs)');
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Could not complete sign in');
          setTimeout(() => router.replace('/login'), 2500);
        }
      }
    }

    getIncomingAuthUrl().then((url) => {
      if (!cancelled) completeAuth(url);
    });

    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      if (!cancelled) completeAuth(url);
    });

    return () => {
      cancelled = true;
      linkingSub.remove();
    };
  }, [router]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.title}>Sign-in failed</Text>
          <Text style={styles.message}>{error}</Text>
          <Text style={styles.hint}>Redirecting to login...</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.title}>Signing you in...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.cream,
  },
  title: {
    marginTop: theme.spacing.lg,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.dark,
  },
  message: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.mediumGray,
    textAlign: 'center',
  },
  hint: {
    marginTop: theme.spacing.md,
    fontSize: 13,
    color: theme.colors.mediumGray,
  },
});
