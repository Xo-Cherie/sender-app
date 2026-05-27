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

interface FlipCardProps {
  frontImage: CardImageValue;
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
        <CardImage source={frontImage} style={styles.image} resizeMode="cover" />
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
