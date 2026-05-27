import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { useCards } from '@/hooks/useCards';
import { cardTemplates } from '@/constants/cardTemplates';
import { CardImage } from '@/components/cards/CardImage';
import { RecipientDeliveryStatus } from '@/types';

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

  // Compute aggregate delivery status for a card
  function getAggregateStatus(statuses?: RecipientDeliveryStatus[]): 'xo' | 'opened' | 'delivered' | null {
    if (!statuses || statuses.length === 0) return null;
    if (statuses.some(s => s.isXod)) return 'xo';
    if (statuses.some(s => s.isRead)) return 'opened';
    return 'delivered';
  }

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
              const template = cardTemplates.find(t => t.id === card.templateId);
              const categoryName = template?.category || 'Card';
              const isDraft = card.status === 'draft';
              const aggStatus = isDraft ? null : getAggregateStatus(card.deliveryStatuses);

              const statusConfig = aggStatus === 'xo'
                ? { label: 'Xo Received', icon: 'favorite' as const, color: theme.colors.primary, bg: theme.colors.primaryLight }
                : aggStatus === 'opened'
                ? { label: 'Opened on Device', icon: 'tablet-mac' as const, color: '#5C9E6B', bg: '#E6F4EA' }
                : aggStatus === 'delivered'
                ? { label: 'Delivered', icon: 'check-circle' as const, color: '#4A7FC1', bg: '#EAF0FB' }
                : null;
              
              return (
                <View key={card.id} style={styles.cardContainer}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cardItem,
                      pressed && styles.cardItemPressed,
                    ]}
                    onPress={() => {
                      if (isDraft) {
                        console.log('Edit draft:', card.id);
                      } else {
                        router.push(`/card-detail?id=${card.id}&viewMode=sent`);
                      }
                    }}
                  >
                    {card.frontImage ? (
                      <CardImage source={card.frontImage} style={styles.cardThumbnail} resizeMode="cover" />
                    ) : (
                      <View style={styles.cardIcon}>
                        <MaterialIcons
                          name={isDraft ? 'drafts' : 'card-giftcard'}
                          size={24}
                          color={theme.colors.primary}
                        />
                      </View>
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardRecipient}>
                        To: {card.recipientNames && card.recipientNames.length > 0 ? card.recipientNames.join(', ') : 'No recipients'}
                      </Text>
                      <Text style={styles.cardCategory}>{categoryName}</Text>
                      <Text style={styles.cardDate}>
                        {new Date(card.sentAt || card.createdAt).toLocaleDateString()}
                      </Text>
                      {statusConfig ? (
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                          <MaterialIcons name={statusConfig.icon} size={12} color={statusConfig.color} />
                          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {card.gift && (
                      <View style={styles.giftBadge}>
                        <MaterialIcons name="card-giftcard" size={16} color={theme.colors.white} />
                        <Text style={styles.giftAmount}>${card.gift.amount}</Text>
                      </View>
                    )}
                  </Pressable>
                  <Pressable
                    style={styles.deleteIconButton}
                    onPress={() => isDraft ? handleDeleteDraft(card.id) : handleDeleteSent(card.id)}
                  >
                    <MaterialIcons name="delete" size={20} color={theme.colors.error} />
                  </Pressable>
                </View>
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
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  cardItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  deleteIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  cardItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  cardThumbnail: {
    width: 64,
    height: 80,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.lightGray,
  },
  cardIcon: {
    width: 64,
    height: 80,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  cardRecipient: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.dark,
  },
  cardCategory: {
    fontSize: 13,
    color: theme.colors.primary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  cardDate: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    marginTop: 2,
  },
  giftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  giftAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.white,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    marginTop: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
