import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCards } from '@/hooks/useCards';
import { CardImage } from '@/components/cards/CardImage';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { receivedCards, sentCards } = useCards();

  const unreadCount = receivedCards.filter(c => !c.isRead).length;
  const firstName = user?.name?.split(' ')[0] || 'there';

  type ActivityItem = {
    id: string;
    type: 'sent' | 'received' | 'xo';
    label: string;
    sublabel: string;
    date: string;
    frontImage: any;
    cardId: string;
    viewMode?: string;
  };

  const activityFeed = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    sentCards.forEach(card => {
      items.push({
        id: `sent-${card.id}`,
        type: 'sent',
        label: `You sent a card`,
        sublabel: `To ${card.recipientNames[0] || 'recipient'}`,
        date: card.createdAt,
        frontImage: card.frontImage,
        cardId: card.id,
        viewMode: 'sent',
      });
    });

    receivedCards.forEach(card => {
      items.push({
        id: `received-${card.id}`,
        type: 'received',
        label: `Card from ${card.senderName}`,
        sublabel: card.isRead ? 'Opened' : 'New',
        date: card.createdAt,
        frontImage: card.frontImage,
        cardId: card.id,
      });
      if (card.isXod && card.xodAt) {
        items.push({
          id: `xo-${card.id}`,
          type: 'xo',
          label: `You sent Xo`,
          sublabel: `To ${card.senderName}`,
          date: card.xodAt,
          frontImage: card.frontImage,
          cardId: card.id,
        });
      }
    });

    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [sentCards, receivedCards]);

  const quickActions = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: 'inbox' as const,
      badge: unreadCount,
      onPress: () => router.push('/(tabs)/inbox'),
      color: '#E8C4B8',
    },
    {
      id: 'keepsakes',
      label: 'Keepsakes',
      icon: 'favorite' as const,
      onPress: () => router.push('/(tabs)/keepsakes'),
      color: '#E8D5C4',
    },
    {
      id: 'friends',
      label: 'Friends',
      icon: 'people' as const,
      onPress: () => router.push('/(tabs)/friends'),
      color: '#D4C8BE',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
            <Text style={styles.appName}>Xo Cherie</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.avatarButton}
          >
            <MaterialIcons name="person" size={22} color={theme.colors.primary} />
          </Pressable>
        </View>

        {/* Hero CTA */}
        <Pressable
          style={styles.heroCard}
          onPress={() => router.push('/create-card')}
        >
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroEyebrow}>Start creating</Text>
            <Text style={styles.heroTitle}>Send a Card</Text>
            <Text style={styles.heroSubtitle}>
              Beautifully crafted cards that become permanent keepsakes
            </Text>
          </View>
          <View style={styles.heroIconWrap}>
            <MaterialIcons name="send" size={32} color={theme.colors.white} />
          </View>
        </Pressable>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{sentCards.length}</Text>
            <Text style={styles.statLabel}>Sent</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMiddle]}>
            <Text style={styles.statNumber}>{receivedCards.length}</Text>
            <Text style={styles.statLabel}>Received</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, unreadCount > 0 && { color: theme.colors.primary }]}>
              {unreadCount}
            </Text>
            <Text style={styles.statLabel}>Unread</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickActions}>
            {quickActions.map(action => (
              <Pressable
                key={action.id}
                style={({ pressed }) => [
                  styles.actionCard,
                  pressed && styles.actionCardPressed,
                ]}
                onPress={action.onPress}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: action.color }]}>
                  <MaterialIcons name={action.icon} size={24} color={theme.colors.primary} />
                  {action.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{action.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <MaterialIcons name="chevron-right" size={18} color={theme.colors.mediumGray} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Feature Banner */}
        <View style={styles.featureBanner}>
          <MaterialIcons name="auto-awesome" size={20} color={theme.colors.primary} />
          <Text style={styles.featureText}>
            Every card is a permanent keepsake — cherished forever
          </Text>
        </View>

        {/* Recent Activity */}
        {activityFeed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityList}>
              {activityFeed.map(item => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.activityRow, pressed && { opacity: 0.75 }]}
                  onPress={() =>
                    item.viewMode
                      ? router.push({ pathname: '/card-detail', params: { id: item.cardId, viewMode: item.viewMode } })
                      : router.push({ pathname: '/card-detail', params: { id: item.cardId } })
                  }
                >
                  {/* Thumbnail */}
                  <View style={styles.activityThumb}>
                    <CardImage source={item.frontImage} style={styles.activityThumbImg} resizeMode="cover" />
                  </View>

                  {/* Text */}
                  <View style={styles.activityText}>
                    <Text style={styles.activityLabel} numberOfLines={1}>{item.label}</Text>
                    <Text style={styles.activitySublabel} numberOfLines={1}>{item.sublabel}</Text>
                  </View>

                  {/* Icon + Date */}
                  <View style={styles.activityMeta}>
                    <MaterialIcons
                      name={
                        item.type === 'sent' ? 'send' :
                        item.type === 'xo' ? 'favorite' :
                        item.sublabel === 'Opened' ? 'drafts' : 'mail'
                      }
                      size={16}
                      color={item.type === 'xo' ? theme.colors.primary : theme.colors.mediumGray}
                    />
                    <Text style={styles.activityDate}>
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
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
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  greeting: {
    fontSize: 15,
    color: theme.colors.mediumGray,
    fontWeight: '500',
    marginBottom: 2,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
    letterSpacing: -0.5,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.elevated,
  },
  heroTextBlock: {
    flex: 1,
    marginRight: theme.spacing.lg,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.white,
    fontFamily: theme.fonts.serif,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.card,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  statCardMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.lightGray,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.dark,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    marginTop: 3,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.mediumGray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.md,
  },
  quickActions: {
    gap: theme.spacing.sm,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  actionCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.white,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.dark,
  },
  activityList: {
    gap: theme.spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  activityThumb: {
    width: 48,
    height: 60,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    flexShrink: 0,
  },
  activityThumbImg: {
    width: 48,
    height: 60,
  },
  activityText: {
    flex: 1,
  },
  activityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.dark,
  },
  activitySublabel: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    marginTop: 2,
  },
  activityMeta: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  activityDate: {
    fontSize: 11,
    color: theme.colors.mediumGray,
    fontWeight: '500',
  },
  featureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.primaryDark,
    lineHeight: 20,
    fontWeight: '500',
  },
});
