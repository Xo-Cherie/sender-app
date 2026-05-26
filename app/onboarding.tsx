import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { Button } from '@/components/ui/Button';

const slides = [
  {
    id: '1',
    title: 'Welcome to Cherie',
    description: 'Send a little love they can hold onto.\nOne message, one moment, kept forever.',
    image: require('@/assets/images/onboarding-1.png'),
  },
  {
    id: '2',
    title: 'Send Beautiful Cards',
    description: 'Not just sent. Saved.\nMake your words last.',
    image: require('@/assets/images/onboarding-2.png'),
  },
  {
    id: '3',
    title: 'Cherish Forever',
    description: 'Keep all your special moments as permanent digital keepsakes',
    image: require('@/assets/images/onboarding-3.png'),
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentSlide = slides[currentIndex];

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      router.replace('/login');
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Pressable onPress={handleSkip} style={styles.skipButton}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.slideContainer}>
        <View style={styles.slide}>
          <Image
            key={currentSlide.id}
            source={currentSlide.image}
            style={styles.image}
            contentFit="cover"
          />
          <View style={styles.content}>
            <Text style={styles.title}>{currentSlide.title}</Text>
            <Text style={styles.description}>{currentSlide.description}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>

        <Button
          title={currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          style={styles.button}
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
  skipButton: {
    position: 'absolute',
    top: 60,
    right: theme.spacing.lg,
    zIndex: 10,
    padding: theme.spacing.sm,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  slideContainer: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: undefined,
    aspectRatio: 1 / 1.2,
  },
  content: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.dark,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    fontFamily: theme.fonts.serif,
  },
  description: {
    fontSize: 16,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.lightGray,
  },
  activeDot: {
    backgroundColor: theme.colors.primary,
    width: 24,
  },
  button: {
    width: '100%',
  },
});
