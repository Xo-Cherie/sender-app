import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { useCards } from '@/hooks/useCards';
import { CardTimelineItem } from '@/components/cards/CardTimelineItem';
import { formatCardTimelineDate, getMessagePreview } from '@/lib/cardMessageUtils';
import { getOutboxStatusBadge } from '@/lib/outboxStatus';

export default function OutboxScreen() {
  const router = useRouter();
  const { sentCards, drafts, loading, deleteSentCard, deleteDraft } = useCards();
  const [activeTab, setActiveTab] = React.useState<'sent' | 'drafts'>('sent');

  const handleDeleteSent = async (cardId: string) => {
    try {
      await deleteSentCard(cardId);
    } catch (error) {
      console.error('Error deleting sent card:', error);
    }
  };

  const handleDeleteDraft = async (cardId: string) => {
    try {
      await deleteDraft(cardId);
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  };

  const displayCards = activeTab === 'sent' ? sentCards : drafts;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Outbox</Text>
          <Text style={styles.subtitle}>
            {sentCards.length} sent · {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
            onPress={() => setActiveTab('sent')}
          >
            <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
              Sent Cards
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'drafts' && styles.tabActive]}
            onPress={() => setActiveTab('drafts')}
          >
            <Text style={[styles.tabText, activeTab === 'drafts' && styles.tabTextActive]}>
              Drafts
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : displayCards.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons 
              name={activeTab === 'sent' ? 'send' : 'drafts'} 
              size={64} 
              color={theme.colors.mediumGray} 
            />
            <Text style={styles.emptyText}>
              {activeTab === 'sent' ? 'No sent cards yet' : 'No drafts yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'sent' 
                ? 'Cards you send will appear here' 
                : 'Save incomplete cards as drafts to finish later'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {displayCards.map(card => {
              const isDraft = card.status === 'draft';
              const recipientName =
                card.recipientNames && card.recipientNames.length > 0
                  ? card.recipientNames.join(', ')
                  : 'No recipients';

              return (
                <CardTimelineItem
                  key={card.id}
                  dateLabel={formatCardTimelineDate(card.sentAt || card.createdAt)}
                  direction="To"
                  personName={recipientName}
                  messagePreview={getMessagePreview(card.personalMessage)}
                  statusBadge={getOutboxStatusBadge(card.deliveryStatuses, isDraft)}
                  giftAmount={card.gift?.amount}
                  onPress={() => {
                    if (!isDraft) {
                      router.push(`/card-detail?id=${card.id}&viewMode=sent`);
                    }
                  }}
                  onDelete={() => (isDraft ? handleDeleteDraft(card.id) : handleDeleteSent(card.id))}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing.xl,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.mediumGray,
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
});
