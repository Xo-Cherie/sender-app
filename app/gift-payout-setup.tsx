import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { useGifts } from '@/hooks/useGifts';

export default function GiftPayoutSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const { connectStatus, refreshGifts, beginPayoutSetup } = useGifts();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    refreshGifts().finally(() => setLoading(false));
  }, [refreshGifts]);

  const handleSetup = async () => {
    setError('');
    setLoading(true);
    const result = await beginPayoutSetup();
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const isComplete =
    connectStatus.onboardingComplete ||
    (connectStatus.detailsSubmitted && connectStatus.payoutsEnabled) ||
    params.status === 'complete';

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="large" color={theme.colors.primary} /> : null}
        <Text style={styles.title}>Gift Payout Setup</Text>
        <Text style={styles.message}>
          {isComplete
            ? 'Your payout account is ready. You can claim monetary gifts from received cards.'
            : 'Connect a Stripe payout account to receive monetary gifts sent with cards.'}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isComplete ? (
          <Button title="Connect Payout Account" onPress={handleSetup} size="large" style={styles.button} />
        ) : (
          <Button
            title="View Gift History"
            onPress={() => router.replace('/gift-history?tab=received')}
            size="large"
            style={styles.button}
          />
        )}

        <Button title="Back" onPress={() => router.back()} variant="outline" style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.cream },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 24, fontWeight: '700', color: theme.colors.dark, textAlign: 'center' },
  message: { fontSize: 15, color: theme.colors.mediumGray, textAlign: 'center', lineHeight: 22 },
  error: { fontSize: 14, color: theme.colors.error, textAlign: 'center' },
  button: { minWidth: 240 },
});
