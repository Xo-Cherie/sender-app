import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { theme } from '@/constants/theme';
import { cardTemplates, categoryLabels, CardCategory } from '@/constants/cardTemplates';
import { useFriends } from '@/hooks/useFriends';
import { useCards } from '@/hooks/useCards';
import { useAuth } from '@/hooks/useAuth';
import { Card, MediaAttachment, Gift } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FlipCard } from '@/components/cards/FlipCard';
import { VoiceMemoRecorder } from '@/components/cards/VoiceMemoRecorder';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TEMPLATE_CARD_WIDTH = Math.floor((SCREEN_WIDTH - 24 * 2 - 16) / 2);
const TEMPLATE_IMAGE_HEIGHT = Math.floor(TEMPLATE_CARD_WIDTH * 1.4);

type Step = 'category' | 'template' | 'recipients' | 'message' | 'media' | 'gift' | 'preview';

export default function CreateCardScreen() {
  const router = useRouter();
  const { friends } = useFriends();
  const { sendCard } = useCards();
  const { user } = useAuth();
  
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [customEmail, setCustomEmail] = useState('');
  const [recipientDisplayName, setRecipientDisplayName] = useState('');
  const [senderDisplayName, setSenderDisplayName] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [gift, setGift] = useState<Gift | null>(null);
  const [giftAmount, setGiftAmount] = useState('');

  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const selectedTemplate_data = cardTemplates.find(t => t.id === selectedTemplate);

  const categories = Object.entries(categoryLabels);

  const handleNext = () => {
    const steps: Step[] = ['category', 'template', 'recipients', 'message', 'media', 'gift', 'preview'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: Step[] = ['category', 'template', 'recipients', 'message', 'media', 'gift', 'preview'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    } else {
      router.back();
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate_data || !user || sending) return;

    setSending(true);
    try {
      const recipientIds: string[] = [];
      const recipientNames: string[] = [];

      selectedRecipients.forEach(id => {
        const friend = friends.find(f => f.id === id);
        if (friend) {
          // Use userId (actual user profile ID) for accepted friends, fall back to id
          const actualUserId = friend.userId || friend.id;
          recipientIds.push(actualUserId);
          recipientNames.push(friend.name);
        }
      });

      if (customEmail.trim()) {
        const customId = 'custom-' + Date.now();
        recipientIds.push(customId);
        recipientNames.push(customEmail.split('@')[0]);
      }

      // Always store as template reference - resolves correctly on load for both local and remote images
      const frontImageUrl = `template:${selectedTemplate_data.id}`;

      const card: Card = {
        id: 'card-' + Date.now(),
        senderId: user.id,
        senderName: senderDisplayName || user.name || user.email,
        recipientIds,
        recipientNames,
        category: selectedTemplate_data.category,
        templateId: selectedTemplate_data.id,
        frontImage: frontImageUrl,
        personalMessage: personalMessage || selectedTemplate_data.backMessage,
        mediaAttachments,
        gift: gift || undefined,
        createdAt: new Date().toISOString(),
        status: 'sent',
      };

      await sendCard(card);
      router.replace('/(tabs)/outbox');
    } catch (error) {
      console.error('Failed to send card:', error);
      alert('Failed to send card. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'category':
        return selectedCategory !== null;
      case 'template':
        return selectedTemplate !== null;
      case 'recipients':
        return selectedRecipients.length > 0 || customEmail.trim() !== '';
      case 'message':
        return personalMessage.trim() !== '';
      default:
        return true;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Progress */}
      <View style={styles.progress}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((['category', 'template', 'recipients', 'message', 'media', 'gift', 'preview'].indexOf(step) + 1) / 7) * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Category Selection */}
        {step === 'category' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Choose Occasion</Text>
            <View style={styles.categoryGrid}>
              {categories.map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSelectedCategory(key as CardCategory);
                    setSelectedTemplate(null);
                  }}
                  style={[
                    styles.categoryCard,
                    selectedCategory === key && styles.categoryCardActive,
                  ]}
                >
                  <Text style={styles.categoryLabel}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Template Selection */}
        {step === 'template' && selectedCategory && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Pick a Design</Text>
            <View style={styles.templateGrid}>
              {cardTemplates
                .filter(t => t.category === selectedCategory)
                .map(template => (
                  <Pressable
                    key={template.id}
                    onPress={() => setPreviewTemplate(template.id)}
                    style={[
                      styles.templateCard,
                      selectedTemplate === template.id && styles.templateCardActive,
                    ]}
                  >
                    <View style={styles.templateImageWrapper}>
                      <Image
                        source={typeof template.frontImage === 'string' ? { uri: template.frontImage } : template.frontImage}
                        style={styles.templateImage}
                        contentFit="cover"
                      />
                      <View style={styles.templateTitleOverlay}>
                        <Text style={styles.templateTitleText} numberOfLines={2}>{template.title}</Text>
                      </View>
                    </View>
                    <Text style={styles.templateName}>{template.name}</Text>
                  </Pressable>
                ))}
            </View>
          </View>
        )}

        {/* Recipients */}
        {step === 'recipients' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Send To</Text>
            
            <Text style={styles.sectionLabel}>Friends</Text>
            {acceptedFriends.length === 0 ? (
              <Text style={styles.emptyText}>No friends yet</Text>
            ) : (
              <View style={styles.friendsList}>
                {acceptedFriends.map(friend => (
                  <Pressable
                    key={friend.id}
                    onPress={() => {
                      if (selectedRecipients.includes(friend.id)) {
                        setSelectedRecipients(selectedRecipients.filter(id => id !== friend.id));
                      } else {
                        setSelectedRecipients([...selectedRecipients, friend.id]);
                      }
                    }}
                    style={[
                      styles.friendItem,
                      selectedRecipients.includes(friend.id) && styles.friendItemActive,
                    ]}
                  >
                    <MaterialIcons
                      name={selectedRecipients.includes(friend.id) ? 'check-circle' : 'radio-button-unchecked'}
                      size={24}
                      color={selectedRecipients.includes(friend.id) ? theme.colors.primary : theme.colors.mediumGray}
                    />
                    <Text style={styles.friendName}>{friend.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={[styles.sectionLabel, { marginTop: theme.spacing.lg }]}>Or Enter Email</Text>
            <Input
              name="recipient-email"
              label="Recipient Email"
              placeholder="name@example.com"
              value={customEmail}
              onChangeText={setCustomEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Message */}
        {step === 'message' && selectedTemplate_data && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Your Message</Text>
            
            <Text style={styles.sectionLabel}>Suggested Message</Text>
            <Pressable
              style={styles.suggestionCard}
              onPress={() => setPersonalMessage(selectedTemplate_data.backMessage)}
            >
              <Text style={styles.suggestionText}>{selectedTemplate_data.backMessage}</Text>
              <MaterialIcons name="content-copy" size={20} color={theme.colors.primary} />
            </Pressable>

            <Text style={[styles.sectionLabel, { marginTop: theme.spacing.lg }]}>Write Your Own</Text>
            <Input
              name="personal-message"
              label="Personal Message"
              placeholder="Write a heartfelt message..."
              value={personalMessage}
              onChangeText={setPersonalMessage}
              multiline
              numberOfLines={6}
              style={{ height: 120, textAlignVertical: 'top' }}
            />
          </View>
        )}

        {/* Media */}
        {step === 'media' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Add Media (Optional)</Text>

            {/* Photo / Video placeholder */}
            <Text style={styles.sectionLabel}>Photos &amp; Videos</Text>
            <Pressable style={styles.uploadCard}>
              <MaterialIcons name="add-photo-alternate" size={36} color={theme.colors.mediumGray} />
              <Text style={styles.uploadText}>Tap to add photos or videos</Text>
              <Text style={styles.uploadLimit}>Max 10MB per photo · 30s per video</Text>
            </Pressable>

            {/* Voice Memos */}
            <Text style={[styles.sectionLabel, { marginTop: theme.spacing.lg }]}>Voice Memos</Text>
            <Text style={styles.voiceHint}>Record up to 3 voice messages (max 60s each)</Text>
            <VoiceMemoRecorder
              memos={mediaAttachments}
              onAdd={(memo) => setMediaAttachments(prev => [...prev, memo])}
              onRemove={(id) => setMediaAttachments(prev => prev.filter(m => m.id !== id))}
            />
          </View>
        )}

        {/* Gift */}
        {step === 'gift' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Include a Gift Card (Optional)</Text>
            <Input
              name="gift-amount"
              label="Amount"
              placeholder="Enter amount (e.g., 25)"
              value={giftAmount}
              onChangeText={setGiftAmount}
              keyboardType="numeric"
            />
            {giftAmount.trim() && (
              <Button
                title={`Add $${giftAmount} Gift Card`}
                onPress={() => {
                  setGift({
                    amount: parseFloat(giftAmount),
                    message: 'Enjoy!',
                  });
                }}
              />
            )}
          </View>
        )}

        {/* Preview */}
        {step === 'preview' && selectedTemplate_data && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Preview Your Card</Text>
            
            <Text style={styles.sectionLabel}>To:</Text>
            <Input
              name="recipient-name"
              label="Recipient Name"
              placeholder="Enter recipient name (e.g., Mom, Sarah)"
              value={recipientDisplayName}
              onChangeText={setRecipientDisplayName}
            />
            
            <Text style={[styles.sectionLabel, { marginTop: theme.spacing.md }]}>From:</Text>
            <Input
              name="sender-name"
              label="Sender Name"
              placeholder="Enter your name (e.g., Sarah, Mom & Dad)"
              value={senderDisplayName}
              onChangeText={setSenderDisplayName}
            />
            
            <View style={styles.previewContainer}>
              <FlipCard
                frontImage={selectedTemplate_data.frontImage}
                cardTitle={selectedTemplate_data.title}
                backMessage={personalMessage || selectedTemplate_data.backMessage}
                recipientName={recipientDisplayName || 'Recipient'}
                senderName={senderDisplayName || 'You'}
                size="large"
              />
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewLabel}>From:</Text>
              <Text style={styles.previewValue}>{senderDisplayName || user?.name || user?.email || 'You'}</Text>
              <Text style={[styles.previewLabel, { marginTop: theme.spacing.md }]}>To:</Text>
              <Text style={styles.previewValue}>
                {selectedRecipients.map(id => friends.find(f => f.id === id)?.name).join(', ')}
                {customEmail && ` ${customEmail}`}
              </Text>
              {gift && (
                <>
                  <Text style={[styles.previewLabel, { marginTop: theme.spacing.md }]}>Gift:</Text>
                  <Text style={styles.previewValue}>${gift.amount} Gift Card</Text>
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      {/* Template Preview Modal */}
      <Modal
        visible={previewTemplate !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewTemplate(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable
              style={styles.modalClose}
              onPress={() => setPreviewTemplate(null)}
            >
              <MaterialIcons name="close" size={28} color={theme.colors.dark} />
            </Pressable>
            {previewTemplate && (() => {
              const template = cardTemplates.find(t => t.id === previewTemplate);
              return template ? (
                <>
                  <View style={styles.modalImageWrapper}>
                    <Image
                      source={typeof template.frontImage === 'string' ? { uri: template.frontImage } : template.frontImage}
                      style={styles.modalImage}
                      contentFit="contain"
                    />
                    <View style={styles.modalTitleOverlay}>
                      <Text style={styles.modalTitleText}>{template.title}</Text>
                    </View>
                  </View>
                  <Text style={styles.modalTemplateName}>{template.name}</Text>
                  <Button
                    title="Select This Design"
                    onPress={() => {
                      setSelectedTemplate(template.id);
                      setPreviewTemplate(null);
                    }}
                  />
                </>
              ) : null;
            })()}
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <Button
          title="Back"
          onPress={handleBack}
          variant="outline"
          style={styles.footerButton}
        />
        <Button
          title={step === 'preview' ? (sending ? 'Sending...' : 'Send Card') : 'Next'}
          onPress={step === 'preview' ? handleSend : handleNext}
          disabled={!canProceed() || sending}
          style={styles.footerButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  progress: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing.xl,
  },
  stepContainer: {
    padding: theme.spacing.lg,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.dark,
    marginBottom: theme.spacing.lg,
    fontFamily: theme.fonts.serif,
  },
  categoryGrid: {
    gap: theme.spacing.md,
  },
  categoryCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  categoryCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.cream,
  },
  categoryLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.dark,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  templateCard: {
    width: TEMPLATE_CARD_WIDTH,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  templateCardActive: {
    borderColor: theme.colors.primary,
  },
  templateImageWrapper: {
    width: TEMPLATE_CARD_WIDTH,
    height: TEMPLATE_IMAGE_HEIGHT,
    position: 'relative',
  },
  templateImage: {
    width: TEMPLATE_CARD_WIDTH,
    height: TEMPLATE_IMAGE_HEIGHT,
  },
  templateTitleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
  },
  templateTitleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: theme.fonts.serif,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.3,
  },
  templateName: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.mediumGray,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.white,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.dark,
    marginBottom: theme.spacing.sm,
  },
  friendsList: {
    gap: theme.spacing.sm,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  friendItemActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.cream,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.dark,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  suggestionCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.dark,
    lineHeight: 20,
  },
  uploadCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xxl,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.lightGray,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.dark,
    marginTop: theme.spacing.md,
  },
  uploadLimit: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  voiceHint: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.md,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  previewInfo: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.mediumGray,
  },
  previewValue: {
    fontSize: 16,
    color: theme.colors.dark,
    marginTop: theme.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
    ...theme.shadows.card,
  },
  footerButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 1,
    backgroundColor: theme.colors.cream,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImageWrapper: {
    width: '100%',
    height: 400,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: 400,
    borderRadius: theme.borderRadius.md,
  },
  modalTitleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
  },
  modalTitleText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: theme.fonts.serif,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  modalTemplateName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.dark,
    marginBottom: theme.spacing.lg,
    fontFamily: theme.fonts.serif,
  },
});
