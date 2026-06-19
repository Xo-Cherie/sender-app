import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

export type TimelineStatusBadge = {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  bg: string;
};

type CardTimelineItemProps = {
  dateLabel: string;
  direction: 'From' | 'To';
  personName: string;
  messagePreview: string;
  onPress: () => void;
  isUnread?: boolean;
  statusBadge?: TimelineStatusBadge | null;
  giftAmount?: number;
  onDelete?: () => void;
  showChevron?: boolean;
};

export function CardTimelineItem({
  dateLabel,
  direction,
  personName,
  messagePreview,
  onPress,
  isUnread = false,
  statusBadge,
  giftAmount,
  onDelete,
  showChevron = true,
}: CardTimelineItemProps) {
  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.messageBox, pressed && styles.messageBoxPressed]}
        onPress={onPress}
      >
        <View style={styles.topRow}>
          <View style={styles.metaLeft}>
            {isUnread ? <View style={styles.unreadDot} /> : null}
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
          {giftAmount != null && giftAmount > 0 ? (
            <View style={styles.giftBadge}>
              <MaterialIcons name="card-giftcard" size={12} color={theme.colors.white} />
              <Text style={styles.giftText}>${giftAmount.toFixed(2)}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.personLine}>
          <Text style={styles.direction}>{direction}: </Text>
          <Text style={styles.personName}>{personName}</Text>
        </Text>

        <View style={styles.previewBox}>
          <Text style={styles.previewText} numberOfLines={3}>
            {messagePreview}
          </Text>
        </View>

        {statusBadge ? (
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
            <MaterialIcons name={statusBadge.icon} size={12} color={statusBadge.color} />
            <Text style={[styles.statusText, { color: statusBadge.color }]}>{statusBadge.label}</Text>
          </View>
        ) : null}

        {showChevron ? (
          <View style={styles.chevron}>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.mediumGray} />
          </View>
        ) : null}
      </Pressable>

      {onDelete ? (
        <Pressable style={styles.deleteBtn} onPress={onDelete} hitSlop={8}>
          <MaterialIcons name="delete-outline" size={20} color={theme.colors.error} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.spacing.sm,
  },
  messageBox: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    paddingRight: 36,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    ...theme.shadows.card,
    position: 'relative',
  },
  messageBoxPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  date: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.mediumGray,
  },
  personLine: {
    marginBottom: theme.spacing.sm,
  },
  direction: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.mediumGray,
  },
  personName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.dark,
  },
  previewBox: {
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    marginBottom: theme.spacing.sm,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.charcoal,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  giftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  giftText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.white,
  },
  chevron: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -10,
  },
  deleteBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    ...theme.shadows.card,
  },
});
