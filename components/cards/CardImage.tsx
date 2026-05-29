import React from 'react';
import { ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import { CardImageValue, normalizeCardFrontImage, getCardImageSource } from '@/lib/cardImages';

interface CardImageProps {
  source: CardImageValue | unknown;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

function toContentFit(resizeMode: CardImageProps['resizeMode']): ImageContentFit {
  switch (resizeMode) {
    case 'contain':
      return 'contain';
    case 'stretch':
      return 'fill';
    case 'center':
      return 'none';
    default:
      return 'cover';
  }
}

export function CardImage({
  source,
  style,
  containerStyle,
  resizeMode = 'cover',
}: CardImageProps) {
  const frontImage = normalizeCardFrontImage(source);

  if (!frontImage) {
    return <View style={[style, containerStyle, styles.placeholder]} />;
  }

  // getCardImageSource resolves numeric require() asset IDs to a URI-based
  // source object, which works reliably on both web and native.
  const imageSource = getCardImageSource(frontImage);

  return (
    <ExpoImage
      source={imageSource}
      style={[style, containerStyle as StyleProp<ImageStyle>]}
      contentFit={toContentFit(resizeMode)}
      transition={150}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#E8E8E8',
  },
});
