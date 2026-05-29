import React from 'react';
import { ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import { CardImageValue, normalizeCardFrontImage } from '@/lib/cardImages';

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

  // expo-image reliably resolves require()'d bundled assets and remote URIs on
  // both web and native. A bundled asset is a number; a remote/template-resolved
  // value is a string URI.
  const imageSource = typeof frontImage === 'number' ? frontImage : { uri: frontImage };

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
