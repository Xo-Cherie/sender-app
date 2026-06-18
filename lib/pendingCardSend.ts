import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Card } from '@/types';

const STORAGE_KEY = 'xocherie:pending-card-send';

export type PendingCardSend = {
  giftId: string;
  card: Card;
  primaryRecipientId?: string;
};

export async function savePendingCardSend(payload: PendingCardSend): Promise<void> {
  const serialized = JSON.stringify(payload);
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(STORAGE_KEY, serialized);
    }
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, serialized);
}

export async function loadPendingCardSend(): Promise<PendingCardSend | null> {
  let raw: string | null = null;
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      raw = window.sessionStorage.getItem(STORAGE_KEY);
    }
  } else {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  }

  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingCardSend;
  } catch {
    return null;
  }
}

export async function clearPendingCardSend(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    return;
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}
