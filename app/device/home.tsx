import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCards } from '@/hooks/useCards';
import { normalizeCardFrontImage, getCardImageSource } from '@/lib/cardImages';
import { playDeviceCardArrivalSound } from '@/lib/deviceCardAlertSound';

export default function DeviceHome() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { receivedCards, loading } = useCards();
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!user && !authLoading) router.replace('/device/login');
  }, [authLoading, router, user]);

  const unread = receivedCards.filter(c => !c.isRead);
  const recent = receivedCards.slice(0, 6);
  const keepsakes = receivedCards.filter(c => c.isPinned);
  const firstName = user?.name?.split(' ')[0] || 'there';

  const isDesktop = width >= 900;
  const thumbCols = isDesktop ? 3 : 2;
  const thumbGap = 16;
  const thumbPadding = isDesktop ? 48 : 24;
  const thumbWidth = Math.floor((Math.min(width, 900) - thumbPadding * 2 - thumbGap * (thumbCols - 1)) / thumbCols);
  const thumbHeight = Math.floor(thumbWidth * 1.4);

  if (!user) return null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Hero greeting */}
      <View style={[styles.hero, isDesktop && styles.heroDesktop]}>
        <View style={styles.heroText}>
          <Text style={styles.heroGreeting}>Hello, {firstName} 👋</Text>
          <Text style={styles.heroTitle}>Your Cherie Device</Text>
          {unread.length > 0 ? (
            <View style={styles.newCardsBanner}>
              <View style={styles.newCardsDot} />
              <Text style={styles.newCardsText}>
                You have <Text style={styles.newCardsCount}>{unread.length} new card{unread.length !== 1 ? 's' : ''}</Text> waiting
              </Text>
            </View>
          ) : (
            <Text style={styles.noNewCards}>
              {receivedCards.length === 0 ? 'No cards yet — ask a friend to send you one!' : 'You\'re all caught up ✓'}
            </Text>
          )}
        </View>

        {__DEV__ && (
          <Pressable
            style={styles.testSoundBtn}
            onPress={() => {
              playDeviceCardArrivalSound().catch((error) => {
                console.warn('Test card alert sound failed:', error);
              });
            }}
          >
            <MaterialIcons name="volume-up" size={18} color={theme.colors.primary} />
            <Text style={styles.testSoundText}>Test arrival sound</Text>
          </Pressable>
        )}

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{receivedCards.length}</Text>
            <Text style={styles.statLabel}>Total Cards</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, unread.length > 0 && { color: theme.colors.primary }]}>{unread.length}</Text>
            <Text style={styles.statLabel}>Unread</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{keepsakes.length}</Text>
            <Text style={styles.statLabel}>Keepsakes</Text>
          </View>
        </View>
      </View>

      {/* New cards section */}
      {unread.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.unreadPulse} />
              <Text style={styles.sectionTitle}>New Cards</Text>
            </View>
            <Pressable onPress={() => router.push('/device/inbox')}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={[styles.cardGrid, { gap: thumbGap }]}>
            {unread.slice(0, thumbCols * 2).map(card => {
              const img = normalizeCardFrontImage(card.frontImage);
              const src = img ? getCardImageSource(img) : null;
              return (
                <Pressable
                  key={card.id}
                  style={({ pressed }) => [styles.cardThumb, { width: thumbWidth }, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                  onPress={() => router.push({ pathname: '/device/card/[id]', params: { id: card.id } })}
                >
                  <View style={[styles.thumbImgWrap, { height: thumbHeight }]}>
                    {src ? (
                      <ExpoImage source={src} style={{ width: thumbWidth, height: thumbHeight }} contentFit="cover" />
                    ) : (
                      <View style={[styles.thumbPlaceholder, { height: thumbHeight }]}>
                        <MaterialIcons name="photo" size={28} color={theme.colors.lightGray} />
                      </View>
                    )}
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>New</Text>
                    </View>
                  </View>
                  <View style={styles.thumbInfo}>
                    <Text style={styles.thumbSender} numberOfLines={1}>From {card.senderName}</Text>
                    <Text style={styles.thumbDate}>{new Date(card.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Recent cards */}
      {recent.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Cards</Text>
            <Pressable onPress={() => router.push('/device/inbox')}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={[styles.cardGrid, { gap: thumbGap }]}>
            {recent.map(card => {
              const img = normalizeCardFrontImage(card.frontImage);
              const src = img ? getCardImageSource(img) : null;
              return (
                <Pressable
                  key={card.id}
                  style={({ pressed }) => [styles.cardThumb, { width: thumbWidth }, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                  onPress={() => router.push({ pathname: '/device/card/[id]', params: { id: card.id } })}
                >
                  <View style={[styles.thumbImgWrap, { height: thumbHeight }]}>
                    {src ? (
                      <ExpoImage source={src} style={{ width: thumbWidth, height: thumbHeight }} contentFit="cover" />
                    ) : (
                      <View style={[styles.thumbPlaceholder, { height: thumbHeight }]}>
                        <MaterialIcons name="photo" size={28} color={theme.colors.lightGray} />
                      </View>
                    )}
                    {!card.isRead && <View style={styles.unreadDot} />}
                    {card.isPinned && (
                      <View style={styles.pinBadge}>
                        <MaterialIcons name="bookmark" size={12} color={theme.colors.primary} />
                      </View>
                    )}
                  </View>
                  <View style={styles.thumbInfo}>
                    <Text style={styles.thumbSender} numberOfLines={1}>From {card.senderName}</Text>
                    <Text style={styles.thumbDate}>{new Date(card.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Keepsakes teaser */}
      {keepsakes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Keepsakes</Text>
            <Pressable onPress={() => router.push('/device/keepsakes')}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={[styles.cardGrid, { gap: thumbGap }]}>
            {keepsakes.slice(0, thumbCols).map(card => {
              const img = normalizeCardFrontImage(card.frontImage);
              const src = img ? getCardImageSource(img) : null;
              return (
                <Pressable
                  key={card.id}
                  style={({ pressed }) => [styles.cardThumb, { width: thumbWidth }, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push({ pathname: '/device/card/[id]', params: { id: card.id } })}
                >
                  <View style={[styles.thumbImgWrap, { height: thumbHeight }]}>
                    {src ? (
                      <ExpoImage source={src} style={{ width: thumbWidth, height: thumbHeight }} contentFit="cover" />
                    ) : (
                      <View style={[styles.thumbPlaceholder, { height: thumbHeight }]} />
                    )}
                    <View style={styles.pinBadge}>
                      <MaterialIcons name="bookmark" size={12} color={theme.colors.primary} />
                    </View>
                  </View>
                  <View style={styles.thumbInfo}>
                    <Text style={styles.thumbSender} numberOfLines={1}>From {card.senderName}</Text>
                    <Text style={styles.thumbDate}>{new Date(card.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Empty state */}
      {receivedCards.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <MaterialIcons name="mail-outline" size={56} color={theme.colors.primaryLight} />
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptySub}>Ask someone to send you a card on the Xo Cherie app</Text>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.cream },
  scroll: { paddingBottom: 60 },
  hero: {
    backgroundColor: theme.colors.white,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
    gap: 20,
  },
  heroDesktop: { padding: 48 },
  heroText: { gap: 8 },
  heroGreeting: { fontSize: 16, color: theme.colors.mediumGray, fontWeight: '500' },
  heroTitle: { fontSize: 34, fontWeight: '700', color: theme.colors.dark, fontFamily: theme.fonts.serif, letterSpacing: -0.5 },
  newCardsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  newCardsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
  newCardsText: { fontSize: 14, color: theme.colors.primaryDark, fontWeight: '500' },
  newCardsCount: { fontWeight: '800', color: theme.colors.primary },
  noNewCards: { fontSize: 14, color: theme.colors.mediumGray, marginTop: 4 },
  testSoundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.white,
  },
  testSoundText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: theme.colors.cream, borderRadius: theme.borderRadius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  statNum: { fontSize: 26, fontWeight: '700', color: theme.colors.dark },
  statLabel: { fontSize: 12, color: theme.colors.mediumGray, marginTop: 2, fontWeight: '500' },
  section: { padding: 24, paddingBottom: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.dark },
  unreadPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  seeAll: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  cardThumb: {
    backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.lg,
    overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  thumbImgWrap: { position: 'relative', overflow: 'hidden' },
  thumbPlaceholder: { backgroundColor: theme.colors.creamDark, alignItems: 'center', justifyContent: 'center' },
  thumbInfo: { padding: 10 },
  thumbSender: { fontSize: 13, fontWeight: '700', color: theme.colors.dark },
  thumbDate: { fontSize: 11, color: theme.colors.mediumGray, marginTop: 2 },
  newBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  newBadgeText: { fontSize: 10, fontWeight: '800', color: theme.colors.white },
  unreadDot: {
    position: 'absolute', top: 8, right: 8,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: theme.colors.primary,
    borderWidth: 2, borderColor: theme.colors.white,
  },
  pinBadge: {
    position: 'absolute', top: 8, left: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.dark },
  emptySub: { fontSize: 15, color: theme.colors.mediumGray, textAlign: 'center', maxWidth: 300, lineHeight: 22 },
});
