import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { ReceivedCard } from '@/types';
import { CardImage } from '@/components/cards/CardImage';

interface CardPreviewProps {
  card: ReceivedCard;
  onPress: () => void;
  showBadge?: boolean;
  width?: number;
}

export function CardPreview({ card, onPress, showBadge = true, width }: CardPreviewProps) {
  const imageHeight = width ? Math.round(width * 1.42) : 200;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        width ? { width } : null,
        pressed && styles.pressed,
      ]}
    >
      <CardImage
        source={card.frontImage}
        style={[styles.image, { height: imageHeight }]}
        resizeMode="cover"
      />
      
      <View style={styles.info}>
        <Text style={styles.sender} numberOfLines={1}>
          From {card.senderName}
        </Text>
        <Text style={styles.date}>{new Date(card.createdAt).toLocaleDateString()}</Text>
      </View>

      {showBadge && !card.isRead && (
        <View style={styles.unreadBadge}>
          <MaterialIcons name="fiber-new" size={16} color={theme.colors.white} />
        </View>
      )}

      {card.isPinned && (
        <View style={styles.pinnedIcon}>
          <MaterialIcons name="bookmark" size={18} color={theme.colors.primary} />
        </View>
      )}

      {card.mediaAttachments?.some(m => m.type === 'voice') && (
        <View style={styles.voiceBadge}>
          <MaterialIcons name="mic" size={13} color={theme.colors.white} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 160,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.lightGray,
  },
  info: {
    minHeight: 50,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 9,
    justifyContent: 'center',
  },
  sender: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: theme.colors.dark,
  },
  date: {
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.mediumGray,
    marginTop: 3,
  },
  unreadBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 4,
  },
  pinnedIcon: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: theme.colors.cream,
    borderRadius: 16,
    padding: 4,
  },
  voiceBadge: {
    position: 'absolute',
    bottom: 58,
    right: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
