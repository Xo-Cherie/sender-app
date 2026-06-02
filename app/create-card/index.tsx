import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { CardImage } from '@/components/cards/CardImage';
import { pickAndUploadPhotos, uploadVoiceMemo } from '@/lib/uploadMedia';
import { cardTemplates, categoryLabels, CardCategory } from '@/constants/cardTemplates';
import { useFriends } from '@/hooks/useFriends';
import { useCards } from '@/hooks/useCards';
import { useAuth } from '@/hooks/useAuth';
import { Card, MediaAttachment, Gift } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FlipCard } from '@/components/cards/FlipCard';
import { VoiceMemoRecorder } from '@/components/cards/VoiceMemoRecorder';

type Step = 'category' | 'template' | 'recipients' | 'message' | 'media' | 'gift' | 'preview';

export default function CreateCardScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const templateCardWidth = Math.max(Math.floor((screenWidth - 24 * 2 - 16) / 2), 120);
  const templateImageHeight = Math.floor(templateCardWidth * 1.4);

  const router = useRouter();
  const { friends } = useFriends();
  const { sendCard } = useCards();
  const { user } = useAuth();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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
  const [sent, setSent] = useState(false);
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [gift, setGift] = useState<Gift | null>(null);
  const [giftAmount, setGiftAmount] = useState('');

  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const selectedTemplate_data = cardTemplates.find(t => t.id === selectedTemplate);

  const categories = Object.entries(categoryLabels);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const goToOutbox = () => {
    router.replace('/(tabs)/outbox');
  };

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

  const handlePickPhotos = async () => {
    if (!user) return;
    try {
      setUploadingPhotos(true);
      const newAttachments = await pickAndUploadPhotos(user.id, setUploadProgress);
      setMediaAttachments(prev => [...prev, ...newAttachments]);
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error?.message || 'Failed to upload photos');
      } else {
        Alert.alert('Upload failed', error?.message || 'Failed to upload photos');
      }
    } finally {
      setUploadingPhotos(false);
      setUploadProgress('');
    }
  };

  const handleAddVoiceMemo = async (memo: MediaAttachment) => {
    if (!user) return;

    try {
      setUploadingVoice(true);
      setUploadProgress('Uploading voice memo…');
      const uploadedMemo = await uploadVoiceMemo(user.id, memo.uri, memo.duration, memo.mimeType);
      setMediaAttachments(prev => [...prev, uploadedMemo]);
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error?.message || 'Failed to upload voice memo');
      } else {
        Alert.alert('Upload Failed', error?.message || 'Failed to upload voice memo');
      }
    } finally {
      if (Platform.OS === 'web' && memo.uri.startsWith('blob:')) {
        URL.revokeObjectURL(memo.uri);
      }
      setUploadingVoice(false);
      setUploadProgress('');
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate_data || !user || sending) return;

    setSending(true);
    try {
      const recipientIds: string[] = [];
      const recipientNames: string[] = [];
      const recipientEmails: string[] = [];

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
        const normalizedEmail = customEmail.trim().toLowerCase();
        const customId = 'custom-' + Date.now();
        recipientIds.push(customId);
        recipientNames.push(normalizedEmail.split('@')[0]);
        recipientEmails.push(normalizedEmail);
      }

      // Always store as template reference - resolves correctly on load for both local and remote images
      const frontImageUrl = `template:${selectedTemplate_data.id}`;

      const card: Card = {
        id: 'card-' + Date.now(),
        senderId: user.id,
        senderName: senderDisplayName || user.name || user.email,
        recipientIds,
        recipientNames,
        recipientEmails,
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
      setSent(true);
      redirectTimerRef.current = setTimeout(goToOutbox, 1200);
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

  if (sent) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.sentContainer}>
          <View style={styles.sentIcon}>
            <MaterialIcons name="check" size={40} color={theme.colors.white} />
          </View>
          <Text style={styles.sentTitle}>Sent</Text>
          <Text style={styles.sentMessage}>
            Your card was sent successfully. Taking you to your Outbox...
          </Text>
          <Button title="Go to Outbox" onPress={goToOutbox} size="large" style={styles.sentButton} />
        </View>
      </SafeAreaView>
    );
  }

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
                      { width: templateCardWidth },
                      selectedTemplate === template.id && styles.templateCardActive,
                    ]}
                  >
                    <View style={[styles.templateImageWrapper, { width: templateCardWidth, height: templateImageHeight }]}>
                      <CardImage
                        source={template.frontImage}
                        style={{ width: templateCardWidth, height: templateImageHeight }}
                        resizeMode="cover"
                      />
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

            {/* Photos */}
            <Text style={styles.sectionLabel}>Photos</Text>
            <Pressable
              style={[styles.uploadCard, uploadingPhotos && styles.uploadCardDisabled]}
              onPress={handlePickPhotos}
              disabled={uploadingPhotos}
            >
              {uploadingPhotos ? (
                <>
                  <ActivityIndicator color={theme.colors.primary} size="large" />
                  <Text style={styles.uploadText}>{uploadProgress || 'Uploading…'}</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="add-photo-alternate" size={36} color={theme.colors.primary} />
                  <Text style={styles.uploadText}>Tap to add photos</Text>
                  <Text style={styles.uploadLimit}>Up to 10 photos · 10MB each</Text>
                </>
              )}
            </Pressable>

            {/* Photo thumbnails */}
            {mediaAttachments.filter(a => a.type === 'photo').length > 0 && (
              <View style={styles.photoGrid}>
                {mediaAttachments
                  .filter(a => a.type === 'photo')
                  .map(attachment => (
                    <View key={attachment.id} style={styles.photoThumb}>
                      <ExpoImage
                        source={{ uri: attachment.uri }}
                        style={styles.photoThumbImage}
                        contentFit="cover"
                      />
                      <Pressable
                        style={styles.photoRemove}
                        onPress={() =>
                          setMediaAttachments(prev => prev.filter(a => a.id !== attachment.id))
                        }
                      >
                        <MaterialIcons name="close" size={14} color={theme.colors.white} />
                      </Pressable>
                    </View>
                  ))}
              </View>
            )}

            {/* Voice Memos */}
            <Text style={[styles.sectionLabel, { marginTop: theme.spacing.lg }]}>Voice Memos</Text>
            <Text style={styles.voiceHint}>Record up to 3 voice messages (max 60s each)</Text>
            <VoiceMemoRecorder
              memos={mediaAttachments}
              onAdd={handleAddVoiceMemo}
              onRemove={(id) => setMediaAttachments(prev => prev.filter(m => m.id !== id))}
            />
            {uploadingVoice && (
              <View style={styles.voiceUploading}>
                <ActivityIndicator color={theme.colors.primary} size="small" />
                <Text style={styles.voiceUploadingText}>{uploadProgress || 'Uploading voice memo…'}</Text>
              </View>
            )}
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
                {recipientDisplayName ||
                  [
                    ...selectedRecipients.map(id => friends.find(f => f.id === id)?.name).filter(Boolean),
                    ...(customEmail ? [customEmail] : []),
                  ].join(', ') ||
                  'Recipient'}
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
                    <CardImage
                      source={template.frontImage}
                      style={styles.modalImage}
                      resizeMode="contain"
                    />
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
    position: 'relative',
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
    borderColor: theme.colors.primary,
  },
  uploadCardDisabled: {
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumbImage: {
    width: 80,
    height: 80,
  },
  photoRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHint: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.md,
  },
  voiceUploading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  voiceUploadingText: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    fontWeight: '500',
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
  modalTemplateName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.dark,
    marginBottom: theme.spacing.lg,
    fontFamily: theme.fonts.serif,
  },
  sentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  sentIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.elevated,
  },
  sentTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
    marginBottom: theme.spacing.sm,
  },
  sentMessage: {
    fontSize: 16,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
  },
  sentButton: {
    minWidth: 220,
  },
});
