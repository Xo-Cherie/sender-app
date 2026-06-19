import { RecipientDeliveryStatus } from '@/types';
import { TimelineStatusBadge } from '@/components/cards/CardTimelineItem';

export function getOutboxStatusBadge(
  statuses?: RecipientDeliveryStatus[],
  isDraft?: boolean
): TimelineStatusBadge | null {
  if (isDraft || !statuses || statuses.length === 0) return null;

  if (statuses.some((s) => s.isXod)) {
    return { label: 'Xo Received', icon: 'favorite', color: '#C17B66', bg: '#F5E6E2' };
  }
  if (statuses.some((s) => s.isRead)) {
    return { label: 'Opened on Device', icon: 'tablet-mac', color: '#5C9E6B', bg: '#E6F4EA' };
  }
  if (statuses.every((s) => s.isDelivered)) {
    return { label: 'Delivered to Device', icon: 'check-circle', color: '#4A7FC1', bg: '#EAF0FB' };
  }
  if (statuses.some((s) => s.isDelivered)) {
    return { label: 'Delivered to Device', icon: 'check-circle', color: '#4A7FC1', bg: '#EAF0FB' };
  }
  return { label: 'Pending Delivery', icon: 'schedule', color: '#B07D00', bg: '#FFF4DD' };
}
