import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          const code = url.searchParams.get('code');

          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) throw exchangeError;
          } else {
            const hash = window.location.hash.startsWith('#')
              ? window.location.hash.slice(1)
              : window.location.hash;
            const hashParams = new URLSearchParams(hash);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken && refreshToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionError) throw sessionError;
            }
          }

          window.history.replaceState({}, document.title, '/auth/callback');
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Sign-in link expired or is invalid. Request a new code and try again.');
        }

        if (!cancelled) {
          router.replace('/(tabs)');
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Could not complete sign in');
          setTimeout(() => router.replace('/login'), 2500);
        }
      }
    }

    completeAuth();

    return () => {
      cancelled = true;
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
