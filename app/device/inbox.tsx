import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCards } from '@/hooks/useCards';
import { supabase } from '@/lib/supabase';
import { normalizeCardFrontImage, getCardImageSource } from '@/lib/cardImages';
import type { ReceivedCard } from '@/types';

type Filter = 'all' | 'unread' | 'pinned';

export default function DeviceInbox() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { receivedCards, loading, refreshCards } = useCards();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');

  // Redirect if not signed in
  useEffect(() => {
    if (!user && !loading) {
      router.replace('/device/login');
    }
  }, [user, loading]);

  // Real-time subscription for new cards
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('device-inbox')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'received_cards', filter: `recipient_id=eq.${user.id}` },
        () => { refreshCards(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = receivedCards.filter(card => {
    if (filter === 'unread') return !card.isRead;
    if (filter === 'pinned') return card.isPinned;
    return true;
  });

  const unreadCount = receivedCards.filter(c => !c.isRead).length;

  // Responsive grid: 2 cols on small, 3 on medium, 4 on large screens
  const cols = width >= 1200 ? 4 : width >= 800 ? 3 : 2;
  const gap = 20;
  const padding = 32;
  const cardWidth = Math.floor((width - padding * 2 - gap * (cols - 1)) / cols);
  const cardHeight = Math.floor(cardWidth * 1.4);

  if (!user) return null;

  return (
    <View style={styles.page}>
      {/* Header */}
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
          <Pressable style={styles.signOutBtn} onPress={signOut}>
            <MaterialIcons name="logout" size={18} color={theme.colors.mediumGray} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'unread', 'pinned'] as Filter[]).map(f => (
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

      {/* Grid */}
      <ScrollView contentContainerStyle={[styles.grid, { padding }]} showsVerticalScrollIndicator={false}>
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
              {filter === 'unread' ? 'No unread cards' : filter === 'pinned' ? 'No pinned cards' : 'No cards yet'}
            </Text>
            <Text style={styles.emptySub}>Cards sent to you will appear here</Text>
          </View>
        ) : (
          <View style={[styles.cardGrid, { gap }]}>
            {filtered.map(card => (
              <CardTile
                key={card.id}
                card={card}
                width={cardWidth}
                height={cardHeight}
                onPress={() => router.push({ pathname: '/device/card/[id]', params: { id: card.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function CardTile({ card, width, height, onPress }: { card: ReceivedCard; width: number; height: number; onPress: () => void }) {
  const frontImage = normalizeCardFrontImage(card.frontImage);
  const imageSource = frontImage ? getCardImageSource(frontImage) : null;

  return (
    <Pressable
      style={({ pressed }) => [tileStyles.tile, { width, height: height + 56 }, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      {/* Unread dot */}
      {!card.isRead && <View style={tileStyles.unreadDot} />}

      {/* Pin icon */}
      {card.isPinned && (
        <View style={tileStyles.pinBadge}>
          <MaterialIcons name="push-pin" size={12} color={theme.colors.primary} />
        </View>
      )}

      {/* Card image */}
      <View style={[tileStyles.imageWrap, { width, height }]}>
        {imageSource ? (
          <ExpoImage source={imageSource} style={{ width, height }} contentFit="cover" />
        ) : (
          <View style={[tileStyles.imagePlaceholder, { width, height }]}>
            <MaterialIcons name="photo" size={32} color={theme.colors.lightGray} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={tileStyles.info}>
        <Text style={tileStyles.sender} numberOfLines={1}>From {card.senderName}</Text>
        <Text style={tileStyles.date}>
          {new Date(card.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>

      {/* Xo badge */}
      {card.isXod && (
        <View style={tileStyles.xoBadge}>
          <MaterialIcons name="favorite" size={11} color={theme.colors.primary} />
          <Text style={tileStyles.xoBadgeText}>Xo Sent</Text>
        </View>
      )}
    </Pressable>
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
  grid: { flexGrow: 1 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap' },
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

const tileStyles = StyleSheet.create({
  tile: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute', top: 10, right: 10,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: theme.colors.primary,
    zIndex: 2,
    borderWidth: 2, borderColor: theme.colors.white,
  },
  pinBadge: {
    position: 'absolute', top: 10, left: 10,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  imageWrap: { overflow: 'hidden' },
  imagePlaceholder: { backgroundColor: theme.colors.creamDark, alignItems: 'center', justifyContent: 'center' },
  info: { padding: 12 },
  sender: { fontSize: 13, fontWeight: '700', color: theme.colors.dark },
  date: { fontSize: 12, color: theme.colors.mediumGray, marginTop: 2 },
  xoBadge: {
    position: 'absolute', bottom: 44, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  xoBadgeText: { fontSize: 10, fontWeight: '700', color: theme.colors.primary },
});
