import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { corsHeaders, jsonResponse, stripeRequest } from '../_shared/stripe.ts';

type ClaimGiftPayoutPayload = {
  giftId?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let payload: ClaimGiftPayoutPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload.giftId) {
    return jsonResponse({ error: 'giftId is required' }, 400);
  }

  const { data: gift, error: giftError } = await serviceClient
    .from('card_gifts')
    .select('*')
    .eq('id', payload.giftId)
    .maybeSingle();

  if (giftError) {
    return jsonResponse({ error: giftError.message }, 500);
  }

  if (!gift) {
    return jsonResponse({ error: 'Gift not found' }, 404);
  }

  if (gift.recipient_id !== authData.user.id) {
    return jsonResponse({ error: 'Only the recipient can claim this gift payout' }, 403);
  }

  if (gift.status === 'payout_completed') {
    return jsonResponse({ ok: true, status: gift.status, alreadyClaimed: true });
  }

  if (gift.status !== 'paid' && gift.status !== 'payout_failed') {
    return jsonResponse({ error: `Gift is not ready for payout (status: ${gift.status})` }, 400);
  }

  const { data: connectRow, error: connectError } = await serviceClient
    .from('user_stripe_connect')
    .select('*')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (connectError) {
    return jsonResponse({ error: connectError.message }, 500);
  }

  if (!connectRow?.stripe_connect_account_id) {
    return jsonResponse(
      { error: 'Connect a payout account before claiming gifts', needsOnboarding: true },
      400
    );
  }

  const account = await stripeRequest<{
    payouts_enabled: boolean;
    details_submitted: boolean;
  }>(`/accounts/${connectRow.stripe_connect_account_id}`, { method: 'GET' });

  if (!account.payouts_enabled || !account.details_submitted) {
    await serviceClient
      .from('user_stripe_connect')
      .update({
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_complete: account.payouts_enabled && account.details_submitted,
      })
      .eq('user_id', authData.user.id);

    return jsonResponse(
      { error: 'Complete Stripe payout setup before claiming', needsOnboarding: true },
      400
    );
  }

  await serviceClient
    .from('card_gifts')
    .update({ status: 'payout_pending' })
    .eq('id', gift.id);

  try {
    const transfer = await stripeRequest<{ id: string }>('/transfers', {
      body: {
        amount: gift.amount_cents,
        currency: gift.currency,
        destination: connectRow.stripe_connect_account_id,
        transfer_group: gift.id,
        metadata: {
          gift_id: gift.id,
          recipient_id: authData.user.id,
          card_id: gift.card_id || '',
        },
      },
    });

    const { error: updateError } = await serviceClient
      .from('card_gifts')
      .update({
        status: 'payout_completed',
        stripe_transfer_id: transfer.id,
        claimed_at: new Date().toISOString(),
        payout_completed_at: new Date().toISOString(),
        failure_reason: null,
      })
      .eq('id', gift.id);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({
      ok: true,
      status: 'payout_completed',
      transferId: transfer.id,
      amountCents: gift.amount_cents,
      currency: gift.currency,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payout transfer failed';
    await serviceClient
      .from('card_gifts')
      .update({
        status: 'payout_failed',
        failure_reason: message,
      })
      .eq('id', gift.id);

    return jsonResponse({ error: message }, 500);
  }
});
