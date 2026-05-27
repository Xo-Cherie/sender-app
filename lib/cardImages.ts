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

  const resolved = Image.resolveAssetSource(frontImage as ImageSourcePropType);
  return resolved?.uri || '';
}

export function getCardImageSource(frontImage: CardImageValue): ImageSourcePropType {
  if (typeof frontImage === 'string') {
    return { uri: frontImage };
  }

  const resolved = Image.resolveAssetSource(frontImage as ImageSourcePropType);
  return resolved?.uri ? { uri: resolved.uri } : (frontImage as ImageSourcePropType);
}
