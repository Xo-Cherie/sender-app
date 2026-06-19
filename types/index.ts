import { CardCategory } from '@/constants/cardTemplates';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phoneNumber?: string;
  birthday?: string;
  gender?: string;
  location?: string;
  twoFactorEnabled?: boolean;
  privacySettings?: {
    showEmail?: boolean;
    allowFriendRequests?: boolean;
    shareBirthday?: boolean;
  };
}

export interface Friend {
  id: string;
  userId?: string; // actual user profile ID (id may be a request ID for pending/sent)
  name: string;
  email: string;
  avatar?: string;
  status: 'accepted' | 'pending' | 'sent';
}

export interface MediaAttachment {
  id: string;
  type: 'photo' | 'video' | 'voice';
  uri: string;
  size: number; // in bytes
  duration?: number; // for videos/voice in seconds
  mimeType?: string;
  pendingUpload?: boolean;
}

export type GiftPaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'payout_pending'
  | 'payout_completed'
  | 'payout_failed';

export interface Gift {
  amount: number;
  message: string;
  giftId?: string;
  paymentStatus?: GiftPaymentStatus;
  payoutStatus?: GiftPaymentStatus;
}

export interface CardGiftTransaction {
  id: string;
  cardId?: string;
  senderId: string;
  recipientId?: string;
  recipientEmail?: string;
  amountCents: number;
  currency: string;
  giftMessage?: string;
  status: GiftPaymentStatus;
  failureReason?: string;
  paidAt?: string;
  claimedAt?: string;
  payoutCompletedAt?: string;
  createdAt: string;
  direction: 'sent' | 'received';
}

export interface StripeConnectStatus {
  connectAccountId?: string;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface RecipientDeliveryStatus {
  recipientId: string;
  recipientName: string;
  isDelivered: boolean;
  isRead: boolean;
  isXod: boolean;
}

export interface Card {
  id: string;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  recipientNames: string[];
  senderDisplayName?: string;
  recipientDisplayName?: string;
  recipientEmails?: string[];
  category: CardCategory;
  templateId: string;
  frontImage: string | ReturnType<typeof require>;
  personalMessage: string;
  mediaAttachments: MediaAttachment[];
  gift?: Gift;
  createdAt: string;
  sentAt?: string;
  status: 'draft' | 'sent';
  deliveryStatuses?: RecipientDeliveryStatus[];
}

export interface ReceivedCard extends Card {
  isRead: boolean;
  isPinned: boolean;
  isXod: boolean; // acknowledged with Xo
  xodAt?: string;
  recipientId: string;
}
