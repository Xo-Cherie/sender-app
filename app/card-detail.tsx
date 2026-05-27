import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useCards } from '@/hooks/useCards';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { FlipCard } from '@/components/cards/FlipCard';
import { Button } from '@/components/ui/Button';
import { normalizeCardFrontImage, resolveCardFrontImage } from '@/lib/cardImages';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Card, ReceivedCard } from '@/types';

export default function CardDetailScreen() {
  const { id, viewMode } = useLocalSearchParams<{ id: string; viewMode?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { markAsRead, togglePin, sendXo, deleteReceivedCard, deleteSentCard } = useCards();
  const [card, setCard] = useState<Card | ReceivedCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [xoPressed, setXoPressed] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  
  const isSentView = viewMode === 'sent';
  const scale = useSharedValue(1);
  const xoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Load card directly from database
  useEffect(() => {
    if (!id || !user) return;
    const currentUser = user;
    
    async function loadCard() {
      setLoading(true);
      try {
        if (isSentView) {
          const { data: cardData, error } = await supabase
            .from('cards')
            .select('*')
            .eq('id', id)
            .eq('sender_id', currentUser.id)
            .single();

          if (error) throw error;
          if (!cardData) throw new Error('Card not found');

          const { data: recipientsData } = await supabase
            .from('received_cards')
            .select('recipient_id')
            .eq('card_id', cardData.id);
          const recipients = recipientsData || [];
          const dbRecipientIds = recipients.map((rc: any) => rc.recipient_id);
          const { data: recipientProfiles } = dbRecipientIds.length
            ? await supabase
                .from('user_profiles')
                .select('id, email, first_name, last_name')
                .in('id', dbRecipientIds)
            : { data: [] };
          const recipientProfileById = new Map((recipientProfiles || []).map((profile: any) => [profile.id, profile]));
          const dbRecipientNames = recipients.map((rc: any) => {
            const profile = recipientProfileById.get(rc.recipient_id) as any;
            const fullName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '';
            return fullName || profile?.email || 'Unknown';
          });

          const storedRecipientInfo = cardData.recipient_info || {};
          const finalRecipientNames = (storedRecipientInfo.names && storedRecipientInfo.names.length > 0)
            ? storedRecipientInfo.names
            : (dbRecipientNames.length > 0 ? dbRecipientNames : ['Unknown Recipient']);
          const finalRecipientIds = (storedRecipientInfo.ids && storedRecipientInfo.ids.length > 0)
            ? storedRecipientInfo.ids
            : (dbRecipientIds.length > 0 ? dbRecipientIds : []);

          const processedCard = {
            id: cardData.id,
            senderId: cardData.sender_id,
            senderName: currentUser.name || currentUser.email,
            recipientIds: finalRecipientIds,
            recipientNames: finalRecipientNames,
            category: 'birthday' as any,
            templateId: cardData.design_template || 'bday-1',
            frontImage: resolveCardFrontImage(cardData.front_design_url, cardData.design_template),
            personalMessage: cardData.message || '',
            mediaAttachments: cardData.media_attachments || [],
            gift: cardData.gift_details || undefined,
            createdAt: cardData.created_at,
            sentAt: cardData.created_at,
            status: 'sent' as const,
          };
          
          setCard(processedCard);
        } else {
          const { data: receivedData, error } = await supabase
            .from('received_cards')
            .select('id, card_id, is_read, is_pinned, received_at, acknowledged_at')
            .eq('card_id', id)
            .eq('recipient_id', currentUser.id)
            .single();

          if (error) throw error;
          if (!receivedData) throw new Error('Card not found');

          const rc: any = receivedData;
          const { data: cardData, error: cardError } = await supabase
            .from('cards')
            .select('*')
            .eq('id', rc.card_id)
            .single();

          if (cardError) throw cardError;
          if (!cardData) throw new Error('Card not found');

          const { data: senderProfile } = await supabase
            .from('user_profiles')
            .select('email, first_name, last_name')
            .eq('id', cardData.sender_id)
            .maybeSingle();
          const senderName = senderProfile
            ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() || senderProfile.email
            : 'Unknown';
          
          setCard({
            id: rc.card_id,
            senderId: cardData.sender_id,
            senderName,
            recipientIds: [currentUser.id],
            recipientNames: [currentUser.name || currentUser.email],
            category: 'birthday' as any,
            templateId: cardData.design_template || 'bday-1',
            frontImage: resolveCardFrontImage(cardData.front_design_url, cardData.design_template),
            personalMessage: cardData.message || '',
            mediaAttachments: cardData.media_attachments || [],
            gift: cardData.gift_details,
            createdAt: cardData.created_at,
            status: 'sent' as const,
            isRead: rc.is_read || false,
            isPinned: rc.is_pinned || false,
            isXod: !!rc.acknowledged_at,
            xodAt: rc.acknowledged_at,
            recipientId: currentUser.id,
          });

          // Mark as read if not already
          if (!rc.is_read) {
            markAsRead(id).catch(console.error);
          }
        }
      } catch (error) {
        console.error('Failed to load card:', error);
        setCard(null);
      } finally {
        setLoading(false);
      }
    }

    loadCard();
  // markAsRead is intentionally excluded because useCards currently returns unstable callbacks.
  // Including it here would cause this detail fetch to rerun after every local card-state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, isSentView]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Loading card...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={theme.colors.mediumGray} />
          <Text style={styles.errorText}>Card not found</Text>
          <Text style={styles.errorSubtext}>
            This card may still be loading. Please go back and try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Ensure required fields have values
  const resolvedFrontImage = normalizeCardFrontImage(card.frontImage);
  const displayFrontImage = resolvedFrontImage || 'https://images.unsplash.com/photo-1513885535751-8b9238bd34c2?w=800';
  const displayMessage = card.personalMessage || 'No message';
  const displaySenderName = card.senderName || 'Unknown';
  const displayRecipientNames = Array.isArray(card.recipientNames) && card.recipientNames.length > 0
    ? card.recipientNames
    : ['Recipient'];
  const displayRecipientName = isSentView 
    ? displayRecipientNames[0]
    : 'You';

  console.log('🎨 RENDERING FLIPCARD WITH:');
  console.log('  frontImage:', displayFrontImage);
  console.log('  backMessage:', displayMessage);
  console.log('  recipientName:', displayRecipientName);
  console.log('  senderName:', displaySenderName);
  console.log('  size: large');


  const handleXo = async () => {
    if (!card || !card.id || isSentView) return;
    const receivedCard = card as ReceivedCard;
    if (!receivedCard.isXod) {
      try {
        scale.value = withSpring(1.3, {}, () => {
          scale.value = withSpring(1);
        });
        await sendXo(card.id);
        setXoPressed(true);
      } catch (error) {
        console.error('Failed to send Xo:', error);
        if (Platform.OS === 'web') {
          alert('Failed to send Xo. Please try again.');
        }
      }
    }
  };

  const handleDelete = async () => {
    if (!card || !card.id) return;
    try {
      if (isSentView) {
        await deleteSentCard(card.id);
      } else {
        await deleteReceivedCard(card.id);
      }
      router.back();
    } catch (error) {
      console.error('Failed to delete card:', error);
      if (Platform.OS === 'web') {
        alert('Failed to delete card. Please try again.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Card */}
        <View style={styles.cardContainer}>
          <FlipCard
            frontImage={displayFrontImage}
            backMessage={displayMessage}
            recipientName={displayRecipientName}
            senderName={displaySenderName}
            size="large"
          />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.from}>
            {isSentView 
              ? `To: ${displayRecipientNames.join(', ')}`
              : `From ${card.senderName}`}
          </Text>
          <Text style={styles.date}>
            Sent {new Date(card.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        {/* Gift */}
        {card.gift && (
          <View style={styles.giftCard}>
            <MaterialIcons name="card-giftcard" size={32} color={theme.colors.primary} />
            <Text style={styles.giftTitle}>Gift Card Included</Text>
            <Text style={styles.giftAmount}>${card.gift.amount}</Text>
            {card.gift.message && (
              <Text style={styles.giftMessage}>{card.gift.message}</Text>
            )}
            <Button title="View Gift" onPress={() => {}} variant="outline" />
          </View>
        )}

        {/* Xo Button - Only for received cards */}
        {!isSentView && 'isXod' in card && (() => {
          const receivedCard = card as ReceivedCard;
          return (
            <Pressable onPress={handleXo} style={styles.xoButton}>
              <Animated.View style={[styles.xoContent, xoAnimatedStyle]}>
                <MaterialIcons
                  name={receivedCard.isXod || xoPressed ? 'favorite' : 'favorite-border'}
                  size={32}
                  color={receivedCard.isXod || xoPressed ? theme.colors.primary : theme.colors.mediumGray}
                />
                <Text style={styles.xoText}>
                  {receivedCard.isXod || xoPressed ? 'Xo Sent!' : 'Send Xo'}
                </Text>
              </Animated.View>
            </Pressable>
          );
        })()}

        {/* Actions - Only for received cards */}
        {!isSentView && 'isPinned' in card && (() => {
          const receivedCard = card as ReceivedCard;
          return (
            <View style={styles.actions}>
              <Pressable
                onPress={() => togglePin(card.id)}
                style={[styles.actionButton, receivedCard.isPinned && styles.actionButtonActive]}
              >
                <MaterialIcons
                  name={receivedCard.isPinned ? 'push-pin' : 'push-pin'}
                  size={24}
                  color={receivedCard.isPinned ? theme.colors.white : theme.colors.dark}
                />
                <Text style={[styles.actionText, receivedCard.isPinned && styles.actionTextActive]}>
                  {receivedCard.isPinned ? 'Pinned' : 'Pin'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowDeleteAlert(true)}
                style={styles.actionButton}
              >
                <MaterialIcons name="delete" size={24} color={theme.colors.error} />
                <Text style={[styles.actionText, { color: theme.colors.error }]}>Delete</Text>
              </Pressable>
            </View>
          );
        })()}
      </ScrollView>

      {/* Delete Confirmation (Web-compatible) */}
      {Platform.OS === 'web' ? (
        <Modal visible={showDeleteAlert} transparent animationType="fade">
          <View style={styles.alertOverlay}>
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>Delete Card</Text>
              <Text style={styles.alertMessage}>
                Are you sure you want to delete this card? This action can not be undone.
              </Text>
              <View style={styles.alertActions}>
                <Pressable
                  style={[styles.alertButton, styles.alertButtonCancel]}
                  onPress={() => setShowDeleteAlert(false)}
                >
                  <Text style={styles.alertButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.alertButton, styles.alertButtonDelete]}
                  onPress={() => {
                    setShowDeleteAlert(false);
                    handleDelete();
                  }}
                >
                  <Text style={[styles.alertButtonText, { color: theme.colors.white }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing.xxl,
  },
  cardContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  info: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  from: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.dark,
    textAlign: 'center',
    fontFamily: theme.fonts.serif,
  },
  date: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  giftCard: {
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.card,
    marginBottom: theme.spacing.lg,
  },
  giftTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.dark,
    marginTop: theme.spacing.sm,
  },
  giftAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.primary,
    marginVertical: theme.spacing.sm,
  },
  giftMessage: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  xoButton: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  xoContent: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  xoText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.dark,
    marginTop: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  actionButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.dark,
  },
  actionTextActive: {
    color: theme.colors.white,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.dark,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  errorSubtext: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  alertBox: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 320,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.dark,
    marginBottom: theme.spacing.sm,
  },
  alertMessage: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  alertActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  alertButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  alertButtonCancel: {
    backgroundColor: theme.colors.lightGray,
  },
  alertButtonDelete: {
    backgroundColor: theme.colors.error,
  },
  alertButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.dark,
  },
});
