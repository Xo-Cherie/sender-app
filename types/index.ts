import { CardCategory } from '@/constants/cardTemplates';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
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
}

export interface Gift {
  amount: number;
  message: string;
}

export interface RecipientDeliveryStatus {
  recipientId: string;
  recipientName: string;
  isRead: boolean;
  isXod: boolean;
}

export interface Card {
  id: string;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  recipientNames: string[];
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
