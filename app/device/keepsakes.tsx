import React, { useEffect } from 'react';
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
import { normalizeCardFrontImage, getCardImageSource } from '@/lib/cardImages';

export default function DeviceKeepsakes() {
  const router = useRouter();
  const { user } = useAuth();
  const { receivedCards, loading } = useCards();
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!user) router.replace('/device/login');
  }, [user]);

  const keepsakes = receivedCards.filter(c => c.isPinned);

  const isDesktop = width >= 900;
  const cols = isDesktop ? 4 : width >= 600 ? 3 : 2;
  const gap = 16;
  const padding = isDesktop ? 48 : 24;
  const cardWidth = Math.floor((Math.min(width, 1200) - padding * 2 - gap * (cols - 1)) / cols);
  const cardHeight = Math.floor(cardWidth * 1.4);

  if (!user) return null;

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.vaultIcon}>
            <MaterialIcons name="bookmark" size={22} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Keepsakes</Text>
            <Text style={styles.headerSub}>
              {keepsakes.length} saved keepsake{keepsakes.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/device/inbox')} style={styles.inboxBtn}>
          <MaterialIcons name="inbox" size={16} color={theme.colors.primary} />
          <Text style={styles.inboxBtnText}>All Cards</Text>
        </Pressable>
      </View>

      {/* Tip */}
      <View style={styles.tip}>
        <MaterialIcons name="info-outline" size={15} color={theme.colors.primary} />
        <Text style={styles.tipText}>
          Open any card and tap <Text style={{ fontWeight: '700' }}>Save to Keepsakes</Text> to preserve it here forever.
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.grid, { padding }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : keepsakes.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="bookmark-border" size={40} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Your Keepsakes is empty</Text>
            <Text style={styles.emptySub}>
              Open a card and tap "Save to Keepsakes" to preserve it here. Your most cherished cards will live here forever.
            </Text>
            <Pressable style={styles.goToInbox} onPress={() => router.push('/device/inbox')}>
              <Text style={styles.goToInboxText}>Go to My Cards</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.cardGrid, { gap }]}>
              {keepsakes.map(card => {
                const img = normalizeCardFrontImage(card.frontImage);
                const src = img ? getCardImageSource(img) : null;
                return (
                  <Pressable
                    key={card.id}
                    style={({ pressed }) => [
                      styles.tile,
                      { width: cardWidth, height: cardHeight + 60 },
                      pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
                    ]}
                    onPress={() => router.push({ pathname: '/device/card/[id]', params: { id: card.id } })}
                  >
                    {/* Bookmark icon */}
                    <View style={styles.bookmarkBadge}>
                      <MaterialIcons name="bookmark" size={14} color={theme.colors.primary} />
                    </View>

                    {/* Image */}
                    <View style={[styles.tileImg, { height: cardHeight }]}>
                      {src ? (
                        <ExpoImage source={src} style={{ width: cardWidth, height: cardHeight }} contentFit="cover" />
                      ) : (
                        <View style={[styles.tilePlaceholder, { height: cardHeight }]}>
                          <MaterialIcons name="photo" size={28} color={theme.colors.lightGray} />
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <View style={styles.tileInfo}>
                      <Text style={styles.tileSender} numberOfLines={1}>From {card.senderName}</Text>
                      <Text style={styles.tileDate}>
                        {new Date(card.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      {card.isXod && (
                        <View style={styles.xoBadge}>
                          <MaterialIcons name="favorite" size={10} color={theme.colors.primary} />
                          <Text style={styles.xoBadgeText}>Xo</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.footerNote}>
              These cards are saved forever in your Keepsakes ♥
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: theme.colors.lightGray,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vaultIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.dark, fontFamily: theme.fonts.serif },
  headerSub: { fontSize: 13, color: theme.colors.mediumGray, marginTop: 2 },
  inboxBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: theme.colors.white,
  },
  inboxBtnText: { fontSize: 13, color: theme.colors.primary, fontWeight: '700' },
  tip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  tipText: { flex: 1, fontSize: 13, color: theme.colors.primaryDark, lineHeight: 18 },
  grid: { flexGrow: 1 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg, overflow: 'hidden',
    position: 'relative',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4,
  },
  bookmarkBadge: {
    position: 'absolute', top: 10, right: 10, zIndex: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  tileImg: { overflow: 'hidden' },
  tilePlaceholder: { backgroundColor: theme.colors.creamDark, alignItems: 'center', justifyContent: 'center' },
  tileInfo: { padding: 12 },
  tileSender: { fontSize: 13, fontWeight: '700', color: theme.colors.dark },
  tileDate: { fontSize: 11, color: theme.colors.mediumGray, marginTop: 2 },
  xoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    marginTop: 6, alignSelf: 'flex-start',
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  xoBadgeText: { fontSize: 10, fontWeight: '700', color: theme.colors.primary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32, gap: 14 },
  emptyIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.dark, textAlign: 'center' },
  emptySub: { fontSize: 15, color: theme.colors.mediumGray, textAlign: 'center', lineHeight: 24, maxWidth: 340 },
  goToInbox: {
    backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full,
    paddingHorizontal: 28, paddingVertical: 14, marginTop: 8,
  },
  goToInboxText: { color: theme.colors.white, fontSize: 15, fontWeight: '700' },
  footerNote: {
    textAlign: 'center', fontSize: 14, color: theme.colors.mediumGray,
    marginTop: 32, fontStyle: 'italic', paddingHorizontal: 24,
  },
});
