import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useCards } from '@/hooks/useCards';
import { CardPreview } from '@/components/cards/CardPreview';

type FilterType = 'all' | 'unread' | 'pinned';

export default function InboxScreen() {
  const router = useRouter();
  const { receivedCards, loading, refreshCards, deleteReceivedCard } = useCards();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [deviceInfoVisible, setDeviceInfoVisible] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshCards();
    setRefreshing(false);
  };

  const filteredCards = receivedCards.filter(card => {
    if (filter === 'unread') return !card.isRead;
    if (filter === 'pinned') return card.isPinned;
    return true;
  });

  const unreadCount = receivedCards.filter(c => !c.isRead).length;

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    { key: 'pinned', label: 'Pinned' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Inbox</Text>
            <Text style={styles.subtitle}>
              {filteredCards.length} {filteredCards.length === 1 ? 'card' : 'cards'}
              {unreadCount > 0 && ` · ${unreadCount} new`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerBtn} onPress={() => setDeviceInfoVisible(true)}>
              <MaterialIcons name="info-outline" size={20} color={theme.colors.primary} />
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={onRefresh}>
              <MaterialIcons name="refresh" size={20} color={theme.colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filters.map(f => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Cards */}
        {loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : filteredCards.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="mail-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptySubtext}>Cards sent to you will appear here</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredCards.map(card => (
              <View key={card.id} style={styles.cardWrapper}>
                <CardPreview
                  card={card}
                  onPress={() => router.push({ pathname: '/card-detail', params: { id: card.id } })}
                />
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => deleteReceivedCard(card.id)}
                >
                  <MaterialIcons name="delete-outline" size={18} color={theme.colors.white} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => router.push('/create-card')}>
        <MaterialIcons name="add" size={26} color={theme.colors.white} />
      </Pressable>

      {/* Cherie Device Info Modal */}
      <Modal
        visible={deviceInfoVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDeviceInfoVisible(false)}
      >
        <Pressable style={styles.lockOverlay} onPress={() => setDeviceInfoVisible(false)}>
          <Pressable style={styles.infoBox} onPress={e => e.stopPropagation()}>
            {/* Close */}
            <Pressable style={styles.infoCloseBtn} onPress={() => setDeviceInfoVisible(false)}>
              <MaterialIcons name="close" size={20} color={theme.colors.mediumGray} />
            </Pressable>

            {/* Header */}
            <View style={styles.infoHeader}>
              <MaterialIcons name="tablet-mac" size={32} color={theme.colors.primary} />
              <Text style={styles.infoTitle}>Cherie Device</Text>
              <Text style={styles.infoTagline}>Your dedicated card-receiving display</Text>
            </View>

            {/* Screenshot Placeholder */}
            <View style={styles.screenshotPlaceholder}>
              <View style={styles.screenshotFrame}>
                <View style={styles.screenshotTopBar} />
                <View style={styles.screenshotCardRow}>
                  <View style={[styles.screenshotCard, { backgroundColor: '#E8B4C0' }]} />
                  <View style={[styles.screenshotCard, { backgroundColor: '#C8D8E8' }]} />
                  <View style={[styles.screenshotCard, { backgroundColor: '#D4E8D4' }]} />
                </View>
                <View style={styles.screenshotCardRow}>
                  <View style={[styles.screenshotCard, { backgroundColor: '#E8DCC8' }]} />
                  <View style={[styles.screenshotCard, { backgroundColor: '#F4C4D4' }]} />
                </View>
              </View>
              <Text style={styles.screenshotCaption}>Cherie Device — card inbox &amp; gallery</Text>
            </View>

            {/* What is it */}
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>What is it?</Text>
              <Text style={styles.infoSectionText}>
                Cherie Device is a companion web app designed for tablets and digital photo frames. It acts as your personal card-receiving station — the only place where you can open, flip, and interact with cards sent to you.
              </Text>
            </View>

            {/* How to set up */}
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>How to set it up</Text>
              {[
                { step: '1', text: 'Open a browser on your tablet or display device' },
                { step: '2', text: 'Navigate to your Cherie Device web app URL' },
                { step: '3', text: 'Sign in with the same email and password you use here' },
                { step: '4', text: 'Your cards will appear automatically — tap to flip and open!' },
              ].map(item => (
                <View key={item.step} style={styles.setupStep}>
                  <View style={styles.setupStepBadge}>
                    <Text style={styles.setupStepNum}>{item.step}</Text>
                  </View>
                  <Text style={styles.setupStepText}>{item.text}</Text>
                </View>
              ))}
            </View>

            <Pressable style={styles.infoDismiss} onPress={() => setDeviceInfoVisible(false)}>
              <Text style={styles.infoDismissText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.cream },
  scrollView: { flex: 1 },
  content: { paddingBottom: 110 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  filters: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 9,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: theme.colors.borderGray,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.charcoal,
  },
  filterTextActive: {
    color: theme.colors.white,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  cardWrapper: { position: 'relative' },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(192,80,80,0.85)',
    borderRadius: 14,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyText: {
    fontSize: 16,
    color: theme.colors.mediumGray,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    ...theme.shadows.elevated,
  },
  infoCloseBtn: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
    marginTop: theme.spacing.sm,
  },
  infoTagline: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    marginTop: 4,
    textAlign: 'center',
  },
  screenshotPlaceholder: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  screenshotFrame: {
    width: '100%',
    backgroundColor: theme.colors.creamDark,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.borderGray,
  },
  screenshotTopBar: {
    height: 10,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 5,
    marginBottom: theme.spacing.sm,
  },
  screenshotCardRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  screenshotCard: {
    flex: 1,
    height: 52,
    borderRadius: theme.borderRadius.sm,
    opacity: 0.85,
  },
  screenshotCaption: {
    fontSize: 11,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  infoSection: {
    marginBottom: theme.spacing.md,
  },
  infoSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.dark,
    marginBottom: theme.spacing.sm,
  },
  infoSectionText: {
    fontSize: 14,
    color: theme.colors.charcoal,
    lineHeight: 21,
  },
  setupStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  setupStepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  setupStepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.white,
  },
  setupStepText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.charcoal,
    lineHeight: 20,
  },
  infoDismiss: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  infoDismissText: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  lockOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.fab,
  },
});
