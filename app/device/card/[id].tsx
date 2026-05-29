import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCards } from '@/hooks/useCards';
import { supabase } from '@/lib/supabase';
import { resolveCardFrontImage, normalizeCardFrontImage, getCardImageSource } from '@/lib/cardImages';
import type { ReceivedCard } from '@/types';

export default function DeviceCardViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { markAsRead, togglePin, sendXo } = useCards();
  const { width, height } = useWindowDimensions();

  const [card, setCard] = useState<ReceivedCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [xoSent, setXoSent] = useState(false);
  const [pinned, setPinned] = useState(false);

  // Flip animation
  const rotation = useSharedValue(0);
  const xoScale = useSharedValue(1);

  // Card dimensions — portrait ratio, responsive
  const maxCardWidth = Math.min(width * 0.55, 480);
  const cardWidth = maxCardWidth;
  const cardHeight = Math.floor(cardWidth * 1.4);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(rotation.value, [0, 180], [0, 180])}deg` }],
    opacity: interpolate(rotation.value, [0, 89, 90, 180], [1, 1, 0, 0]),
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(rotation.value, [0, 180], [180, 360])}deg` }],
    opacity: interpolate(rotation.value, [0, 89, 90, 180], [0, 0, 1, 1]),
  }));

  const xoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: xoScale.value }],
  }));

  useEffect(() => {
    if (!id || !user) return;
    loadCard();
  }, [id, user]);

  async function loadCard() {
    setLoading(true);
    try {
      const { data: rc } = await supabase
        .from('received_cards')
        .select('id, card_id, is_read, is_pinned, received_at, acknowledged_at')
        .eq('card_id', id)
        .eq('recipient_id', user!.id)
        .single();

      if (!rc) throw new Error('Card not found');

      const { data: cardData } = await supabase
        .from('cards')
        .select('*')
        .eq('id', rc.card_id)
        .single();

      if (!cardData) throw new Error('Card data not found');

      const { data: senderProfile } = await supabase
        .from('user_profiles')
        .select('email, first_name, last_name')
        .eq('id', cardData.sender_id)
        .maybeSingle();

      const senderName = senderProfile
        ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() || senderProfile.email
        : 'Unknown';

      const loaded: ReceivedCard = {
        id: rc.card_id,
        senderId: cardData.sender_id,
        senderName,
        recipientIds: [user!.id],
        recipientNames: [user!.name || user!.email],
        category: 'birthday' as any,
        templateId: cardData.design_template || '',
        frontImage: resolveCardFrontImage(cardData.front_design_url, cardData.design_template),
        personalMessage: cardData.message || '',
        mediaAttachments: cardData.media_attachments || [],
        gift: cardData.gift_details || undefined,
        createdAt: cardData.created_at,
        status: 'sent',
        isRead: rc.is_read || false,
        isPinned: rc.is_pinned || false,
        isXod: !!rc.acknowledged_at,
        xodAt: rc.acknowledged_at,
        recipientId: user!.id,
      };

      setCard(loaded);
      setXoSent(!!rc.acknowledged_at);
      setPinned(rc.is_pinned || false);

      // Mark as read
      if (!rc.is_read) markAsRead(id).catch(console.error);
    } catch (err) {
      console.error('Failed to load card:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleFlip() {
    const next = isFlipped ? 0 : 180;
    rotation.value = withTiming(next, { duration: 600 });
    setIsFlipped(!isFlipped);
  }

  async function handleXo() {
    if (!card || xoSent) return;
    xoScale.value = withSpring(1.4, {}, () => { xoScale.value = withSpring(1); });
    setXoSent(true);
    await sendXo(card.id).catch(console.error);
  }

  async function handlePin() {
    if (!card) return;
    setPinned(p => !p);
    await togglePin(card.id).catch(console.error);
  }

  if (loading) {
    return (
      <View style={styles.page}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Opening your card…</Text>
        </View>
      </View>
    );
  }

  if (!card) {
    return (
      <View style={styles.page}>
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color={theme.colors.mediumGray} />
          <Text style={styles.errorText}>Card not found</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const frontImage = normalizeCardFrontImage(card.frontImage);
  const imageSource = frontImage ? getCardImageSource(frontImage) : null;
  const photos = card.mediaAttachments?.filter(a => a.type === 'photo') || [];

  return (
    <View style={styles.page}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.backPressable} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.colors.dark} />
          <Text style={styles.backLabel}>All Cards</Text>
        </Pressable>
        <View style={styles.topBarRight}>
          <Text style={styles.topBarSender}>From {card.senderName}</Text>
          <Text style={styles.topBarDate}>
            {new Date(card.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

          {/* Left: Card flip */}
          <View style={styles.cardSide}>
            <Text style={styles.tapHint}>{isFlipped ? 'Tap card to see front' : 'Tap card to read message'}</Text>
            <Pressable onPress={handleFlip} style={[styles.flipContainer, { width: cardWidth, height: cardHeight }]}>
              {/* Front */}
              <Animated.View style={[styles.face, { width: cardWidth, height: cardHeight }, frontStyle]}>
                {imageSource ? (
                  <ExpoImage source={imageSource} style={{ width: cardWidth, height: cardHeight, borderRadius: theme.borderRadius.lg }} contentFit="cover" />
                ) : (
                  <View style={[styles.imagePlaceholder, { width: cardWidth, height: cardHeight }]}>
                    <MaterialIcons name="photo" size={48} color={theme.colors.lightGray} />
                  </View>
                )}
              </Animated.View>

              {/* Back */}
              <Animated.View style={[styles.face, styles.back, { width: cardWidth, height: cardHeight }, backStyle]}>
                <View style={styles.backInner}>
                  <Text style={styles.backTo}>To: {card.recipientNames[0] || 'You'}</Text>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                    <Text style={styles.backMessage}>{card.personalMessage}</Text>
                  </ScrollView>
                  <Text style={styles.backSig}>— {card.senderName}</Text>
                </View>
              </Animated.View>
            </Pressable>
          </View>

          {/* Right: Actions + details */}
          <View style={styles.rightSide}>

            {/* Xo button */}
            <Animated.View style={xoAnimStyle}>
              <Pressable
                style={[styles.xoBtn, xoSent && styles.xoBtnActive]}
                onPress={handleXo}
                disabled={xoSent}
              >
                <MaterialIcons
                  name={xoSent ? 'favorite' : 'favorite-border'}
                  size={28}
                  color={xoSent ? theme.colors.white : theme.colors.primary}
                />
                <Text style={[styles.xoBtnText, xoSent && styles.xoBtnTextActive]}>
                  {xoSent ? 'Xo Sent! ♥' : 'Send Xo'}
                </Text>
              </Pressable>
            </Animated.View>

            {/* Pin */}
            <Pressable style={[styles.actionBtn, pinned && styles.actionBtnActive]} onPress={handlePin}>
              <MaterialIcons name="push-pin" size={20} color={pinned ? theme.colors.white : theme.colors.dark} />
              <Text style={[styles.actionBtnText, pinned && styles.actionBtnTextActive]}>
                {pinned ? 'Pinned' : 'Pin Card'}
              </Text>
            </Pressable>

            {/* Gift */}
            {card.gift && (
              <View style={styles.giftBox}>
                <MaterialIcons name="card-giftcard" size={28} color={theme.colors.primary} />
                <Text style={styles.giftTitle}>Gift Card Included</Text>
                <Text style={styles.giftAmount}>${card.gift.amount}</Text>
                {card.gift.message ? <Text style={styles.giftMsg}>{card.gift.message}</Text> : null}
              </View>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <View style={styles.photosBox}>
                <Text style={styles.photosSectionTitle}>Photos</Text>
                <View style={styles.photosGrid}>
                  {photos.map(photo => (
                    <ExpoImage
                      key={photo.id}
                      source={{ uri: photo.uri }}
                      style={styles.photoThumb}
                      contentFit="cover"
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Card info */}
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <MaterialIcons name="person" size={16} color={theme.colors.mediumGray} />
                <Text style={styles.infoText}>From {card.senderName}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="schedule" size={16} color={theme.colors.mediumGray} />
                <Text style={styles.infoText}>
                  {new Date(card.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              {card.isXod && (
                <View style={styles.infoRow}>
                  <MaterialIcons name="favorite" size={16} color={theme.colors.primary} />
                  <Text style={[styles.infoText, { color: theme.colors.primary }]}>You sent Xo</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.cream },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  backPressable: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.dark },
  topBarRight: { alignItems: 'flex-end' },
  topBarSender: { fontSize: 15, fontWeight: '700', color: theme.colors.dark, fontFamily: theme.fonts.serif },
  topBarDate: { fontSize: 13, color: theme.colors.mediumGray, marginTop: 2 },
  scroll: { flexGrow: 1 },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 48,
    padding: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cardSide: { alignItems: 'center' },
  tapHint: { fontSize: 13, color: theme.colors.mediumGray, marginBottom: 16, fontStyle: 'italic' },
  flipContainer: { position: 'relative' },
  face: {
    position: 'absolute',
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  back: { backgroundColor: theme.colors.cream },
  backInner: { flex: 1, padding: 28, justifyContent: 'center' },
  backTo: { fontSize: 13, fontWeight: '600', color: theme.colors.mediumGray, marginBottom: 20 },
  backMessage: {
    fontSize: 20,
    lineHeight: 32,
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
    textAlign: 'center',
    flex: 1,
  },
  backSig: { fontSize: 20, color: theme.colors.primary, fontStyle: 'italic', textAlign: 'right', marginTop: 20 },
  imagePlaceholder: { backgroundColor: theme.colors.creamDark, alignItems: 'center', justifyContent: 'center', borderRadius: theme.borderRadius.lg },
  rightSide: { flex: 1, minWidth: 260, maxWidth: 360, gap: 16 },
  xoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 16,
    paddingHorizontal: 28,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  xoBtnActive: { backgroundColor: theme.colors.primary },
  xoBtnText: { fontSize: 17, fontWeight: '700', color: theme.colors.primary },
  xoBtnTextActive: { color: theme.colors.white },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  actionBtnActive: { backgroundColor: theme.colors.primary },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.dark },
  actionBtnTextActive: { color: theme.colors.white },
  giftBox: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  giftTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.dark, marginTop: 8 },
  giftAmount: { fontSize: 32, fontWeight: '700', color: theme.colors.primary, marginVertical: 6 },
  giftMsg: { fontSize: 13, color: theme.colors.mediumGray, textAlign: 'center' },
  photosBox: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  photosSectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.dark, marginBottom: 10 },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: 80, height: 80, borderRadius: theme.borderRadius.sm },
  infoBox: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, color: theme.colors.charcoal },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  loadingText: { fontSize: 15, color: theme.colors.mediumGray, marginTop: 16 },
  errorText: { fontSize: 18, fontWeight: '600', color: theme.colors.dark, marginTop: 16 },
  backBtn: {
    marginTop: 20, backgroundColor: theme.colors.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: theme.borderRadius.full,
  },
  backBtnText: { color: theme.colors.white, fontWeight: '700', fontSize: 15 },
});
