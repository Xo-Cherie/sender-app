import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { User } from '@/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  resendOtp: (email: string) => Promise<{ error: string | null }>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildNameFromAuthUser(authUser: SupabaseUser): string {
  const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
  const first = typeof meta.first_name === 'string' ? meta.first_name : '';
  const last = typeof meta.last_name === 'string' ? meta.last_name : '';
  const combined = [first, last].filter(Boolean).join(' ').trim();
  if (combined) return combined;
  if (typeof meta.full_name === 'string' && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  return authUser.email || 'User';
}

function getStringField(...values: unknown[]): string | undefined {
  const value = values.find(item => typeof item === 'string' && item.trim().length > 0);
  return typeof value === 'string' ? value.trim() : undefined;
}

function getPrivacySettings(...values: unknown[]): User['privacySettings'] {
  const value = values.find(item => item && typeof item === 'object') as User['privacySettings'] | undefined;
  return {
    showEmail: value?.showEmail ?? false,
    allowFriendRequests: value?.allowFriendRequests ?? true,
    shareBirthday: value?.shareBirthday ?? false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Handle app state changes
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      subscription.unsubscribe();
      appStateListener?.remove();
    };
  }, []);

  async function loadUserProfile(authUser: SupabaseUser) {
    const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
    const fallbackName = buildNameFromAuthUser(authUser);
    const fallbackUser: User = {
      id: authUser.id,
      email: authUser.email || '',
      name: getStringField(meta.display_name, meta.full_name) || fallbackName,
      avatar: getStringField(meta.avatar_url),
      firstName: getStringField(meta.first_name),
      lastName: getStringField(meta.last_name),
      displayName: getStringField(meta.display_name),
      phoneNumber: getStringField(meta.phone_number),
      birthday: getStringField(meta.birthday),
      gender: getStringField(meta.gender),
      location: getStringField(meta.location),
      twoFactorEnabled: meta.two_factor_enabled === true,
      privacySettings: getPrivacySettings(meta.privacy_settings),
    };

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading user profile:', error);
      }

      if (data) {
        const firstName = getStringField(data.first_name, meta.first_name);
        const lastName = getStringField(data.last_name, meta.last_name);
        const displayName = getStringField(data.display_name, meta.display_name);
        const fullName = displayName || [firstName, lastName].filter(Boolean).join(' ').trim() || fallbackName;
        setUser({
          id: data.id,
          email: data.email || authUser.email || '',
          name: fullName,
          avatar: getStringField(data.avatar_url, meta.avatar_url),
          firstName,
          lastName,
          displayName,
          phoneNumber: getStringField(data.phone_number, meta.phone_number),
          birthday: getStringField(data.birthday, meta.birthday),
          gender: getStringField(data.gender, meta.gender),
          location: getStringField(data.location, meta.location),
          twoFactorEnabled: data.two_factor_enabled === true || meta.two_factor_enabled === true,
          privacySettings: getPrivacySettings(data.privacy_settings, meta.privacy_settings),
        });
        return;
      }

      // No profile row yet — e.g. a brand-new recipient who just signed up from
      // an invite link, or an account whose creation trigger didn't run.
      // Create it so the account behaves identically on every device.
      await ensureUserProfile(authUser);
      setUser(fallbackUser);
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Never block a valid session on profile issues. Falling back to the auth
      // user guarantees the inbox/cards still load (they only need id + email).
      setUser(fallbackUser);
    } finally {
      setLoading(false);
    }
  }

  async function ensureUserProfile(authUser: SupabaseUser) {
    const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
    const firstName = typeof meta.first_name === 'string' ? meta.first_name : '';
    const lastName = typeof meta.last_name === 'string' ? meta.last_name : '';

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          {
            id: authUser.id,
            email: authUser.email,
            first_name: firstName,
            last_name: lastName,
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.warn('Could not create user profile row:', error.message);
      }
    } catch (error) {
      console.warn('Could not create user profile row:', error);
    }
  }

  async function signUp(email: string, password: string, name: string) {
    try {
      // Split name into first and last name
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });

      if (error) return { error: error.message };
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'Sign up failed' };
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error: error.message };
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'Sign in failed' };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function verifyOtp(email: string, token: string) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) return { error: error.message };
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'Verification failed' };
    }
  }

  async function resendOtp(email: string) {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });

      if (error) return { error: error.message };
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'Resend failed' };
    }
  }

  async function refreshUser() {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await loadUserProfile(data.user);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signUp,
        signIn,
        signOut,
        verifyOtp,
        resendOtp,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
