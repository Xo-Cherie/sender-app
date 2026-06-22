import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

/** Routes users to reset-password when Supabase emits PASSWORD_RECOVERY. */
export function AuthRecoveryRedirect() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password' as '/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
