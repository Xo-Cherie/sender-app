import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    const userId = user.id;
    let isActive = true;

    async function fetchUnreadCount() {
      try {
        const { count, error } = await supabase
          .from('received_cards')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', userId)
          .eq('is_read', false);

        if (!error && isActive) {
          setUnreadCount(count ?? 0);
        }
      } catch {
        // Silently fail — badge is non-critical
      }
    }

    fetchUnreadCount();

    // React Native dev remounts can reuse topics before cleanup finishes.
    const channel = supabase
      .channel(`unread-count-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'received_cards',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { unreadCount };
}
