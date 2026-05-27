import React from 'react';
import {
  Image,
  ImageSourcePropType,
  ImageStyle,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  CardImageValue,
  getCardImageSource,
  getCardImageUri,
  normalizeCardFrontImage,
} from '@/lib/cardImages';

interface CardImageProps {
  source: CardImageValue | unknown;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export function CardImage({
  source,
  style,
  containerStyle,
  resizeMode = 'cover',
}: CardImageProps) {
  const frontImage = normalizeCardFrontImage(source);
  const flatStyle = StyleSheet.flatten(style) || {};
  const width = flatStyle.width ?? '100%';
  const height = flatStyle.height ?? '100%';
  const borderRadius = flatStyle.borderRadius;

  if (!frontImage) {
    return <View style={[style, containerStyle, styles.placeholder]} />;
  }

  if (Platform.OS === 'web') {
    const uri = getCardImageUri(frontImage);
    if (!uri) {
      return <View style={[style, containerStyle, styles.placeholder]} />;
    }

    return (
      <View
        style={[
          containerStyle,
          {
            width,
            height,
            borderRadius,
            overflow: 'hidden',
            backgroundImage: `url("${uri}")`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: resizeMode === 'contain' ? 'contain' : 'cover',
          } as ViewStyle,
        ]}
      />
    );
  }

  return (
    <Image
      source={getCardImageSource(frontImage) as ImageSourcePropType}
      style={style}
      resizeMode={resizeMode}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#E8E8E8',
  },
});
