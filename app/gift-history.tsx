import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useGifts } from '@/hooks/useGifts';
import { centsToDollars, getGiftStatusLabel, isStripeLiveMode } from '@/lib/gifts';
import type { GiftPaymentStatus } from '@/types';

function statusColor(status: GiftPaymentStatus) {
  switch (status) {
    case 'paid':
    case 'payout_completed':
      return theme.colors.success || '#2E7D32';
    case 'failed':
    case 'canceled':
    case 'refunded':
    case 'payout_failed':
      return theme.colors.error;
    case 'processing':
    case 'pending':
    case 'payout_pending':
      return theme.colors.primary;
    default:
      return theme.colors.mediumGray;
  }
}

export default function GiftHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'sent' | 'received'>(params.tab === 'received' ? 'received' : 'sent');
  const { sentGifts, receivedGifts, loading, refreshGifts } = useGifts();

  useEffect(() => {
    refreshGifts();
  }, [refreshGifts]);

  const items = tab === 'sent' ? sentGifts : receivedGifts;

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={theme.colors.dark} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Gift Transactions</Text>
          <Text style={styles.subtitle}>
            {isStripeLiveMode() ? 'Live payments' : 'Stripe sandbox mode'}
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['sent', 'received'] as const).map((value) => (
          <Pressable
            key={value}
            style={[styles.tab, tab === value && styles.tabActive]}
            onPress={() => setTab(value)}
          >
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>
              {value === 'sent' ? 'Sent' : 'Received'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="payments" size={42} color={theme.colors.primaryLight} />
            <Text style={styles.emptyTitle}>No {tab} gifts yet</Text>
            <Text style={styles.emptySub}>
              {tab === 'sent'
                ? 'Monetary gifts you send with cards will appear here.'
                : 'Gifts sent to you will appear here after payment completes.'}
            </Text>
          </View>
        ) : (
          items.map((gift) => (
            <View key={gift.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.amount}>${centsToDollars(gift.amountCents)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor(gift.status)}22` }]}>
                  <Text style={[styles.statusText, { color: statusColor(gift.status) }]}>
                    {getGiftStatusLabel(gift.status)}
                  </Text>
                </View>
              </View>
              {gift.giftMessage ? <Text style={styles.message}>{gift.giftMessage}</Text> : null}
              <Text style={styles.meta}>
                {new Date(gift.createdAt).toLocaleString()}
                {gift.cardId ? ` · Card linked` : ''}
              </Text>
              {gift.failureReason ? (
                <Text style={styles.failure}>{gift.failureReason}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cream,
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.dark },
  subtitle: { fontSize: 13, color: theme.colors.mediumGray, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.colors.white,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.colors.charcoal },
  tabTextActive: { color: theme.colors.white },
  list: { padding: 20, gap: 12 },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 24, fontWeight: '700', color: theme.colors.primary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.full },
  statusText: { fontSize: 12, fontWeight: '700' },
  message: { fontSize: 14, color: theme.colors.dark },
  meta: { fontSize: 12, color: theme.colors.mediumGray },
  failure: { fontSize: 12, color: theme.colors.error },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.dark },
  emptySub: { fontSize: 14, color: theme.colors.mediumGray, textAlign: 'center', maxWidth: 280 },
});
