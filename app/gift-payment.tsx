import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { useCards } from '@/hooks/useCards';
import { verifyGiftPayment } from '@/lib/gifts';
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctions';
import { clearPendingCardSend, loadPendingCardSend } from '@/lib/pendingCardSend';

function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function verifyPaidGift(input: { giftId?: string; sessionId?: string }) {
  const delays = [0, 1500, 3000];
  let lastError = 'Payment was not completed.';

  for (const delayMs of delays) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const { data: verified, error: verifyError } = await verifyGiftPayment(input);
    if (verified?.status === 'paid') {
      return { verified, error: null as string | null };
    }

    lastError = verifyError
      ? await getEdgeFunctionErrorMessage(verifyError, verifyError.message)
      : `Payment was not completed (status: ${verified?.status || 'unknown'}).`;
  }

  return { verified: null, error: lastError };
}

export default function GiftPaymentScreen() {
  const router = useRouter();
  const { sendCard } = useCards();
  const params = useLocalSearchParams<{
    status?: string;
    session_id?: string;
    gift_id?: string;
  }>();

  const [message, setMessage] = useState('Verifying your gift payment…');
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function finalizePayment() {
      const giftId = readParam(params.gift_id);
      const sessionId = readParam(params.session_id);
      const status = readParam(params.status);

      if (status === 'canceled') {
        if (mounted) {
          setError('Gift payment was canceled. Your card was not sent.');
          await clearPendingCardSend();
        }
        return;
      }

      if (!giftId && !sessionId) {
        if (mounted) setError('Missing payment reference.');
        return;
      }

      const { verified, error: verifyErrorMessage } = await verifyPaidGift({ giftId, sessionId });
      if (!mounted) return;

      if (verifyErrorMessage || !verified) {
        setError(verifyErrorMessage || 'Payment was not completed.');
        return;
      }

      const pending = await loadPendingCardSend();
      if (!pending || pending.giftId !== verified.giftId) {
        if (verified.cardId) {
          setCompleted(true);
          setMessage('Gift payment completed.');
          return;
        }
        setError('Payment succeeded, but the pending card draft was not found. Please try sending again.');
        return;
      }

      try {
        await sendCard({
          ...pending.card,
          gift: {
            ...(pending.card.gift || { amount: (verified.amountCents || 0) / 100, message: 'Enjoy your gift!' }),
            giftId: verified.giftId,
            paymentStatus: 'paid',
          },
        });
        await clearPendingCardSend();
        setCompleted(true);
        setMessage('Payment complete. Your card and gift were sent successfully.');
      } catch (sendError: any) {
        setError(sendError?.message || 'Payment succeeded, but sending the card failed.');
      }
    }

    finalizePayment();

    return () => {
      mounted = false;
    };
  }, [params.gift_id, params.session_id, params.status, sendCard]);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        {!error && !completed && <ActivityIndicator size="large" color={theme.colors.primary} />}
        <Text style={styles.title}>{completed ? 'Success' : error ? 'Payment Issue' : 'Processing'}</Text>
        <Text style={styles.message}>{error || message}</Text>
        {(completed || error) && (
          <Button
            title={completed ? 'Go to Outbox' : 'Back to Create Card'}
            onPress={() => router.replace(completed ? '/(tabs)/outbox' : '/create-card')}
            size="large"
            style={styles.button}
          />
        )}
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.dark,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: { marginTop: 12, minWidth: 220 },
});
