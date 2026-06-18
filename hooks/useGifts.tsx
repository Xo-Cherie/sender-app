import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  claimGiftPayout,
  mapConnectRow,
  mapGiftRow,
  startConnectOnboarding,
  openConnectOnboarding,
} from '@/lib/gifts';
import { useAuth } from '@/hooks/useAuth';
import type { CardGiftTransaction, StripeConnectStatus } from '@/types';

export function useGifts() {
  const { user } = useAuth();
  const [sentGifts, setSentGifts] = useState<CardGiftTransaction[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<CardGiftTransaction[]>([]);
  const [connectStatus, setConnectStatus] = useState<StripeConnectStatus>({
    onboardingComplete: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
  });
  const [loading, setLoading] = useState(false);

  const refreshGifts = useCallback(async () => {
    if (!user?.id) {
      setSentGifts([]);
      setReceivedGifts([]);
      return;
    }

    setLoading(true);
    try {
      const [sentResult, receivedResult, connectResult] = await Promise.all([
        supabase
          .from('card_gifts')
          .select('*')
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('card_gifts')
          .select('*')
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_stripe_connect')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (sentResult.error) throw sentResult.error;
      if (receivedResult.error) throw receivedResult.error;
      if (connectResult.error) throw connectResult.error;

      setSentGifts((sentResult.data || []).map((row) => mapGiftRow(row, 'sent')));
      setReceivedGifts((receivedResult.data || []).map((row) => mapGiftRow(row, 'received')));
      setConnectStatus(mapConnectRow(connectResult.data));
    } catch (error) {
      console.warn('Failed to load gift transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshGifts();
  }, [refreshGifts]);

  const claimPayout = useCallback(
    async (giftId: string) => {
      const { data, error } = await claimGiftPayout(giftId);
      if (error) {
        const needsOnboarding = Boolean(
          typeof data === 'object' && data && 'needsOnboarding' in data && data.needsOnboarding
        );
        return {
          error: error.message || 'Could not claim gift payout',
          needsOnboarding,
        };
      }

      await refreshGifts();
      return { error: null, data };
    },
    [refreshGifts]
  );

  const beginPayoutSetup = useCallback(async () => {
    const { data, error } = await startConnectOnboarding();
    if (error || !data?.onboardingUrl) {
      return { error: error?.message || data?.error || 'Could not start payout setup' };
    }

    await openConnectOnboarding(data.onboardingUrl);
    await refreshGifts();
    return { error: null };
  }, [refreshGifts]);

  const getGiftById = useCallback(
    (giftId?: string) => {
      if (!giftId) return undefined;
      return [...sentGifts, ...receivedGifts].find((gift) => gift.id === giftId);
    },
    [receivedGifts, sentGifts]
  );

  return {
    sentGifts,
    receivedGifts,
    allGifts: [...sentGifts, ...receivedGifts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    connectStatus,
    loading,
    refreshGifts,
    claimPayout,
    beginPayoutSetup,
    getGiftById,
  };
}
