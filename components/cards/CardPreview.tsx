import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { ReceivedCard } from '@/types';

interface CardPreviewProps {
  card: ReceivedCard;
  onPress: () => void;
  showBadge?: boolean;
}

export function CardPreview({ card, onPress, showBadge = true }: CardPreviewProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={(typeof card.frontImage === 'string' ? { uri: card.frontImage } : card.frontImage) as any}
        style={styles.image}
        contentFit="cover"
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
          <MaterialIcons name="push-pin" size={18} color={theme.colors.primary} />
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
    marginRight: theme.spacing.md,
    ...theme.shadows.card,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.lightGray,
  },
  info: {
    marginTop: theme.spacing.sm,
  },
  sender: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.dark,
  },
  date: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    marginTop: 2,
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
    bottom: 40,
    right: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
