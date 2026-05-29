import { Asset } from 'expo-asset';
import { Image, ImageSourcePropType } from 'react-native';
import { cardTemplates } from '@/constants/cardTemplates';

export type CardImageValue = string | number;

/** Resolve DB template refs and fallbacks to a displayable image value. */
export function resolveCardFrontImage(
  frontDesignUrl: string | null | undefined,
  designTemplate?: string | null
): CardImageValue {
  if (frontDesignUrl && frontDesignUrl.startsWith('template:')) {
    const templateId = frontDesignUrl.replace('template:', '');
    const template = cardTemplates.find((t) => t.id === templateId);
    if (template) return template.frontImage;

    const fallbackTemplate = designTemplate
      ? cardTemplates.find((t) => t.id === designTemplate)
      : undefined;
    return fallbackTemplate?.frontImage || cardTemplates[0]?.frontImage || '';
  }

  if (frontDesignUrl && typeof frontDesignUrl === 'string') {
    return frontDesignUrl;
  }

  if (designTemplate) {
    const template = cardTemplates.find((t) => t.id === designTemplate);
    if (template) return template.frontImage;
  }

  return '';
}

/** Normalize any stored card front value (template ref, uri, or bundled asset). */
export function normalizeCardFrontImage(value: unknown): CardImageValue {
  if (typeof value === 'number') {
    return value;
  }

  // On web with Metro static output, require() returns {uri, width, height} instead of a number.
  if (typeof value === 'object' && value !== null && 'uri' in value) {
    const uri = (value as { uri: unknown }).uri;
    if (typeof uri === 'string' && uri) return uri;
  }

  if (typeof value !== 'string' || !value) {
    return '';
  }

  if (value.startsWith('template:')) {
    return resolveCardFrontImage(value, null);
  }

  return value;
}

export function getCardImageUri(frontImage: CardImageValue): string {
  if (typeof frontImage === 'string') {
    return frontImage;
  }

  // For bundled assets (require()'d modules), resolveAssetSource is the most
  // reliable resolver on both web and native. Asset.fromModule().uri can be
  // empty on web until the asset is downloaded, which previously caused the
  // card artwork to fall back to a grey placeholder.
  const resolved = Image.resolveAssetSource(frontImage as ImageSourcePropType);
  if (resolved?.uri) {
    return resolved.uri;
  }

  const asset = Asset.fromModule(frontImage);
  return asset?.uri || asset?.localUri || '';
}

export function getCardImageSource(frontImage: CardImageValue): ImageSourcePropType {
  if (typeof frontImage === 'string') {
    return { uri: frontImage };
  }

  const uri = getCardImageUri(frontImage);
  return uri ? { uri } : (frontImage as ImageSourcePropType);
}
