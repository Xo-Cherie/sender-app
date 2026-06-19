import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCards } from '@/hooks/useCards';
import { CardTimelineItem } from '@/components/cards/CardTimelineItem';
import { formatCardTimelineDate, getMessagePreview } from '@/lib/cardMessageUtils';

type Filter = 'all' | 'unread';

export default function DeviceInbox() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { receivedCards, loading, refreshCards } = useCards();
  const [filter, setFilter] = useState<Filter>('all');

  const handleSignOut = async () => {
    await signOut();
    router.replace('/device/login');
  };

  useEffect(() => {
    if (!user && !loading) {
      router.replace('/device/login');
    }
  }, [loading, router, user]);

  const filtered = receivedCards.filter(card => {
    if (filter === 'unread') return !card.isRead;
    return true;
  });

  const unreadCount = receivedCards.filter(c => !c.isRead).length;

  if (!user) return null;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogo}>
            <MaterialIcons name="tablet-mac" size={22} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Cherie Device</Text>
            <Text style={styles.headerSub}>
              Hello, {user.name?.split(' ')[0] || user.email} · {receivedCards.length} card{receivedCards.length !== 1 ? 's' : ''}
              {unreadCount > 0 ? ` · ${unreadCount} new` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.refreshBtn} onPress={refreshCards}>
            <MaterialIcons name="refresh" size={20} color={theme.colors.primary} />
          </Pressable>
          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <MaterialIcons name="logout" size={18} color={theme.colors.mediumGray} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.filters}>
        {(['all', 'unread'] as Filter[]).map(f => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'unread' ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.timelineWrap} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading your cards…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centered}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="mail-outline" size={40} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'unread' ? 'No unread cards' : 'No cards yet'}
            </Text>
            <Text style={styles.emptySub}>Cards sent to you will appear here</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {filtered.map(card => (
              <CardTimelineItem
                key={card.id}
                dateLabel={formatCardTimelineDate(card.createdAt)}
                direction="From"
                personName={card.senderName}
                messagePreview={getMessagePreview(card.personalMessage)}
                isUnread={!card.isRead}
                giftAmount={card.gift?.amount}
                onPress={() => router.push({ pathname: '/device/card/[id]', params: { id: card.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.dark, fontFamily: theme.fonts.serif },
  headerSub: { fontSize: 13, color: theme.colors.mediumGray, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1, borderColor: theme.colors.borderGray,
    backgroundColor: theme.colors.white,
  },
  signOutText: { fontSize: 13, color: theme.colors.mediumGray, fontWeight: '600' },
  filters: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1.5, borderColor: theme.colors.borderGray,
    backgroundColor: theme.colors.white,
  },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { fontSize: 14, fontWeight: '600', color: theme.colors.charcoal },
  filterTextActive: { color: theme.colors.white },
  timelineWrap: { flexGrow: 1, padding: 32 },
  timeline: { gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, width: '100%' },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.dark, marginBottom: 8 },
  emptySub: { fontSize: 15, color: theme.colors.mediumGray },
  loadingText: { fontSize: 15, color: theme.colors.mediumGray, marginTop: 16 },
});
