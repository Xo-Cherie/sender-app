import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** Redirect URL for Supabase email confirmation / magic links. */
export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }

  // Email links open in Gmail/Chrome, not inside the app. Custom schemes
  // (xocherie://) often land on about:blank. Use the public HTTPS URL when set.
  const configured = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) {
    return `${configured}/auth/callback`;
  }

  return Linking.createURL('auth/callback');
}
