import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** Redirect URL for Supabase email confirmation / magic links. */
export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }

  return Linking.createURL('auth/callback');
}
