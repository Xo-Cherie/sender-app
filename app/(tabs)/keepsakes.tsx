import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useCards } from '@/hooks/useCards';
import { Input } from '@/components/ui/Input';
import { CardTimelineItem } from '@/components/cards/CardTimelineItem';
import { OnThisDaySection } from '@/components/cards/OnThisDaySection';
import { formatCardTimelineDate, getMessagePreview } from '@/lib/cardMessageUtils';
import {
  collectOnThisDayCardIds,
  getOnThisDayMemoryGroups,
} from '@/lib/keepsakeMemories';
import type { ReceivedCard } from '@/types';

function matchesSearch(card: ReceivedCard, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    card.senderName.toLowerCase().includes(normalized) ||
    card.personalMessage.toLowerCase().includes(normalized)
  );
}

export default function KeepsakesScreen() {
  const router = useRouter();
  const { receivedCards } = useCards();
  const [searchQuery, setSearchQuery] = useState('');

  const keepsakes = receivedCards.filter(card => card.isPinned);

  const onThisDayGroups = useMemo(() => getOnThisDayMemoryGroups(keepsakes), [keepsakes]);
  const onThisDayIds = useMemo(() => collectOnThisDayCardIds(onThisDayGroups), [onThisDayGroups]);

  const filteredOnThisDayGroups = useMemo(() => {
    if (!searchQuery.trim()) return onThisDayGroups;
    return onThisDayGroups
      .map((group) => ({
        ...group,
        cards: group.cards.filter((card) => matchesSearch(card, searchQuery)),
      }))
      .filter((group) => group.cards.length > 0);
  }, [onThisDayGroups, searchQuery]);

  const filteredKeepsakes = keepsakes.filter((card) => {
    if (!matchesSearch(card, searchQuery)) return false;
    if (onThisDayIds.has(card.id)) return false;
    return true;
  });

  const hasOnThisDay = filteredOnThisDayGroups.length > 0;
  const showEmptySearch = keepsakes.length > 0 && !hasOnThisDay && filteredKeepsakes.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Keepsakes</Text>
          <Text style={styles.subtitle}>
            {keepsakes.length} {keepsakes.length === 1 ? 'memory' : 'memories'}
          </Text>
        </View>

        {keepsakes.length > 0 && (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrap}>
              <MaterialIcons name="search" size={20} color={theme.colors.mediumGray} style={styles.searchIcon} />
              <Input
                placeholder="Search memories..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
              />
            </View>
          </View>
        )}

        {keepsakes.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="favorite-border" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No keepsakes yet</Text>
            <Text style={styles.emptySubtext}>
              Open a card and tap Save to Keepsakes to save it here
            </Text>
          </View>
        ) : showEmptySearch ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="search" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No matches</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            <OnThisDaySection
              groups={filteredOnThisDayGroups}
              onCardPress={(id) => router.push(`/card-detail?id=${id}`)}
            />
            {hasOnThisDay && filteredKeepsakes.length > 0 ? (
              <Text style={styles.sectionHeading}>All memories</Text>
            ) : null}
            {filteredKeepsakes.map(card => (
              <CardTimelineItem
                key={card.id}
                dateLabel={formatCardTimelineDate(card.createdAt)}
                direction="From"
                personName={card.senderName}
                messagePreview={getMessagePreview(card.personalMessage)}
                giftAmount={card.gift?.amount}
                onPress={() => router.push(`/card-detail?id=${card.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.cream },
  scrollView: { flex: 1 },
  content: { paddingBottom: theme.spacing.xl },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    marginTop: 2,
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  searchInputWrap: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: 14,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 40,
  },
  timeline: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.mediumGray,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: theme.spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl * 1.5,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.dark,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
});
