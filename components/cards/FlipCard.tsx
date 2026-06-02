import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Text, Dimensions } from 'react-native';
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
            <Text style={styles.recipient}>To: {recipientName}</Text>
          )}
          <View style={styles.backCenter}>
            <Text style={styles.message}>{backMessage}</Text>
            {primaryPhoto ? (
              <Pressable
                style={styles.cardPhotoWrap}
                onPress={() => onPhotoPress?.(primaryPhoto.uri)}
              >
                <CardImage source={primaryPhoto.uri} style={styles.cardPhoto} resizeMode="cover" />
                {photos.length > 1 ? (
                  <View style={styles.photoCountBadge}>
                    <Text style={styles.photoCountText}>+{photos.length - 1}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>
          {senderName && (
            <Text style={styles.signature}>From: {senderName}</Text>
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
    padding: theme.spacing.lg,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  backContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  recipient: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
  },
  backCenter: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  message: {
    fontSize: 22,
    lineHeight: 30,
    color: theme.colors.dark,
    textAlign: 'center',
    fontFamily: theme.fonts.serif,
  },
  cardPhotoWrap: {
    width: '82%',
    aspectRatio: 1.15,
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
  signature: {
    fontSize: 22,
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
    textAlign: 'right',
  },
});
