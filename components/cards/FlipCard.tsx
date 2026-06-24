import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Text, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { CardImage } from '@/components/cards/CardImage';
import { CardImageValue } from '@/lib/cardImages';
import type { MediaAttachment } from '@/types';

interface FlipCardProps {
  frontImage: CardImageValue;
  backMessage: string;
  recipientName?: string;
  senderName?: string;
  mediaAttachments?: MediaAttachment[];
  onPhotoPress?: (uri: string) => void;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

const { width: screenWidth } = Dimensions.get('window');

const sizes = {
  small: { width: screenWidth * 0.4, height: screenWidth * 0.5 },
  medium: { width: screenWidth * 0.7, height: screenWidth * 0.9 },
  large: { width: screenWidth * 0.85, height: screenWidth * 1.1 },
};

function formatMediaTime(seconds?: number): string {
  const value = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(value / 60);
  const remainingSeconds = value % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function FlipCard({
  frontImage,
  backMessage,
  recipientName,
  senderName,
  mediaAttachments = [],
  onPhotoPress,
  onPress,
  size = 'medium',
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const rotation = useSharedValue(0);

  const { width, height } = sizes[size];
  const photos = mediaAttachments.filter((attachment) => attachment.type === 'photo');
  const primaryPhoto = photos[0];
  const voiceMemos = mediaAttachments.filter((attachment) => attachment.type === 'voice');
  const hasVoiceMemos = voiceMemos.length > 0;
  const hasMedia = photos.length > 0 || hasVoiceMemos;
  const isCompactBack = size !== 'large' || hasMedia;
  const photoWidth = Math.min(width * (isCompactBack ? 0.72 : 0.82), width - theme.spacing.lg * 2);
  const photoHeight = Math.min(
    photoWidth / 1.15,
    height * (hasVoiceMemos ? 0.28 : 0.36)
  );
  const messageLineLimit = hasMedia ? (primaryPhoto ? 4 : 6) : 8;
  const voiceLabel = voiceMemos.length === 1 ? 'Voice memo' : `${voiceMemos.length} voice memos`;
  const voiceDuration = voiceMemos.length === 1 ? voiceMemos[0].duration : undefined;



  const handlePress = () => {
    try {
      const newValue = isFlipped ? 0 : 180;
      rotation.value = withTiming(newValue, { duration: 600 });
      setIsFlipped(!isFlipped);
      onPress?.();
    } catch (error) {
      console.error('FlipCard animation error:', error);
    }
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [0, 180]);
    const opacity = interpolate(rotation.value, [0, 90, 90, 180], [1, 1, 0, 0]);
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      opacity,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [180, 360]);
    const opacity = interpolate(rotation.value, [0, 90, 90, 180], [0, 0, 1, 1]);
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      opacity,
    };
  });

  return (
    <Pressable onPress={handlePress} style={[styles.container, { width, height }]}>
      {/* Front */}
      <Animated.View style={[styles.card, styles.front, frontAnimatedStyle, { width, height }]}>
        <CardImage source={frontImage} style={styles.image} resizeMode="cover" />
      </Animated.View>

      {/* Back */}
      <Animated.View style={[styles.card, styles.back, backAnimatedStyle, { width, height }]}>
        <View style={styles.backContent}>
          {recipientName && (
            <Text
              style={[styles.recipient, isCompactBack && styles.recipientCompact]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              To: {recipientName}
            </Text>
          )}
          <View style={styles.backCenter}>
            <Text
              style={[styles.message, isCompactBack && styles.messageCompact]}
              numberOfLines={messageLineLimit}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {backMessage}
            </Text>
            {primaryPhoto ? (
              <Pressable
                style={[styles.cardPhotoWrap, { width: photoWidth, height: photoHeight }]}
                onPress={() => onPhotoPress?.(primaryPhoto.uri)}
              >
                <CardImage source={primaryPhoto.uri} style={styles.cardPhoto} resizeMode="cover" />
                {photos.length > 1 ? (
                  <View style={styles.photoCountBadge}>
                    <Text style={styles.photoCountText}>+{photos.length - 1}</Text>
                  </View>
                ) : null}
                {hasVoiceMemos ? (
                  <View style={styles.voiceBadge}>
                    <MaterialIcons name="mic" size={13} color={theme.colors.white} />
                    <Text style={styles.voiceBadgeText}>
                      {voiceLabel}{voiceDuration ? ` • ${formatMediaTime(voiceDuration)}` : ''}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            {!primaryPhoto && hasVoiceMemos ? (
              <View style={styles.voicePreview}>
                <MaterialIcons name="mic" size={16} color={theme.colors.primary} />
                <Text style={styles.voicePreviewText}>
                  {voiceLabel}{voiceDuration ? ` • ${formatMediaTime(voiceDuration)}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
          {senderName && (
            <Text
              style={[styles.signature, isCompactBack && styles.signatureCompact]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              From: {senderName}
            </Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.elevated,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  front: {
    backgroundColor: theme.colors.white,
  },
  back: {
    backgroundColor: theme.colors.cream,
    padding: theme.spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  backContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: theme.spacing.sm,
  },
  recipient: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
  },
  recipientCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  backCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 0,
    overflow: 'hidden',
  },
  message: {
    fontSize: 22,
    lineHeight: 30,
    color: theme.colors.dark,
    textAlign: 'center',
    fontFamily: theme.fonts.serif,
  },
  messageCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  cardPhotoWrap: {
    alignSelf: 'center',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.primaryLight,
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
  },
  photoCountBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoCountText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  voiceBadge: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(193,123,102,0.92)',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  voiceBadgeText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  voicePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  voicePreviewText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  signature: {
    fontSize: 22,
    lineHeight: 28,
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
    textAlign: 'right',
  },
  signatureCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
});
