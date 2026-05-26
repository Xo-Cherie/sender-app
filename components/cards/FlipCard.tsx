import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Text, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';

interface FlipCardProps {
  frontImage: string | ReturnType<typeof require>;
  cardTitle?: string;
  backMessage: string;
  recipientName?: string;
  senderName?: string;
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
  cardTitle,
  backMessage,
  recipientName,
  senderName,
  onPress,
  size = 'medium',
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const rotation = useSharedValue(0);

  const { width, height } = sizes[size];



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
        <Image 
          source={(typeof frontImage === 'string' ? { uri: frontImage } : frontImage) as any} 
          style={styles.image} 
          contentFit="cover" 
        />
        {cardTitle ? (
          <View style={styles.titleOverlay}>
            <Text style={styles.cardTitle}>{cardTitle}</Text>
          </View>
        ) : null}
        <View style={styles.frontOverlay}>
          <Text style={styles.tapHint}>Tap to open</Text>
        </View>
      </Animated.View>

      {/* Back */}
      <Animated.View style={[styles.card, styles.back, backAnimatedStyle, { width, height }]}>
        <View style={styles.backContent}>
          {recipientName && (
            <Text style={styles.recipient}>To: {recipientName}</Text>
          )}
          <Text style={styles.message}>{backMessage}</Text>
          {senderName && (
            <Text style={styles.signature}>— {senderName}</Text>
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
  titleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: theme.fonts.serif,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  frontOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  tapHint: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  backContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipient: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.dark,
    textAlign: 'center',
    fontFamily: theme.fonts.serif,
  },
  signature: {
    fontSize: 18,
    color: theme.colors.primary,
    marginTop: theme.spacing.lg,
    fontStyle: 'italic',
    alignSelf: 'flex-end',
  },
});
