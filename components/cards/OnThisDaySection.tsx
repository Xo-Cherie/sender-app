import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { CardTimelineItem } from '@/components/cards/CardTimelineItem';
import {
  formatYearsAgoLabel,
  getCardMemoryDate,
  type OnThisDayGroup,
  type KeepsakeMemoryCard,
} from '@/lib/keepsakeMemories';
import { formatCardTimelineDate, getMessagePreview } from '@/lib/cardMessageUtils';

type MemoryCard = KeepsakeMemoryCard & {
  senderName: string;
  personalMessage: string;
  gift?: { amount?: number };
};

type OnThisDaySectionProps = {
  groups: OnThisDayGroup<MemoryCard>[];
  onCardPress: (cardId: string) => void;
};

export function OnThisDaySection({ groups, onCardPress }: OnThisDaySectionProps) {
  if (groups.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <MaterialIcons name="history" size={22} color={theme.colors.primary} />
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>On this day</Text>
          <Text style={styles.bannerSubtitle}>Memories from years past</Text>
        </View>
      </View>

      {groups.map((group) => (
        <View key={group.yearsAgo} style={styles.group}>
          <Text style={styles.groupLabel}>{formatYearsAgoLabel(group.yearsAgo)}</Text>
          <View style={styles.groupCards}>
            {group.cards.map((card) => (
              <CardTimelineItem
                key={card.id}
                dateLabel={formatCardTimelineDate(getCardMemoryDate(card))}
                direction="From"
                personName={card.senderName}
                messagePreview={getMessagePreview(card.personalMessage)}
                giftAmount={card.gift?.amount}
                onPress={() => onCardPress(card.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary + '33',
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: theme.colors.primaryDark,
    marginTop: 2,
    fontWeight: '500',
  },
  group: {
    gap: theme.spacing.sm,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 2,
  },
  groupCards: {
    gap: theme.spacing.md,
  },
});
