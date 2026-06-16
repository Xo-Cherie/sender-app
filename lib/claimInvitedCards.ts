import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { supabase } from '@/lib/supabase';

export async function claimInvitedCardsForSession(): Promise<number> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.email) return 0;

  const { data, error } = await invokeEdgeFunction<{ ok?: boolean; claimed?: number }>('claim-card-invites');
  if (error) {
    console.warn('Failed to claim invited cards:', error.message || error);
    return 0;
  }

  return typeof data?.claimed === 'number' ? data.claimed : 0;
}
