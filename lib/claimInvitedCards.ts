import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { supabase } from '@/lib/supabase';

export async function claimInvitedCardsForSession(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.email) return;

  const { error } = await invokeEdgeFunction('claim-card-invites');
  if (error) {
    console.warn('Failed to claim invited cards:', error.message || error);
  }
}
