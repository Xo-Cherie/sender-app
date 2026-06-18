import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import {
  corsHeaders,
  jsonResponse,
  mapCheckoutPaymentStatus,
  mapPaymentIntentStatus,
  stripeRequest,
  type GiftStatus,
} from '../_shared/stripe.ts';

type VerifyGiftPaymentPayload = {
  giftId?: string;
  sessionId?: string;
};

type StripeCheckoutSession = {
  id: string;
  payment_status: string;
  status: string;
  payment_intent: string | null;
  metadata?: Record<string, string>;
};

type StripePaymentIntent = {
  id: string;
  status: string;
  latest_charge: string | null;
};

async function resolveGiftStatus(session: StripeCheckoutSession): Promise<{
  status: GiftStatus;
  failureReason?: string;
  paidAt?: string;
  canceledAt?: string;
  paymentIntentId?: string | null;
  chargeId?: string | null;
}> {
  if (session.status === 'expired') {
    return { status: 'canceled', canceledAt: new Date().toISOString(), paymentIntentId: session.payment_intent };
  }

  const checkoutStatus = mapCheckoutPaymentStatus(session.payment_status);
  if (checkoutStatus === 'paid') {
    let chargeId: string | null = null;
    if (session.payment_intent) {
      const paymentIntent = await stripeRequest<StripePaymentIntent>(
        `/payment_intents/${session.payment_intent}`,
        { method: 'GET' }
      );
      chargeId = paymentIntent.latest_charge;
    }

    return {
      status: 'paid',
      paidAt: new Date().toISOString(),
      paymentIntentId: session.payment_intent,
      chargeId,
    };
  }

  if (session.payment_intent) {
    const paymentIntent = await stripeRequest<StripePaymentIntent>(
      `/payment_intents/${session.payment_intent}`,
      { method: 'GET' }
    );
    const intentStatus = mapPaymentIntentStatus(paymentIntent.status);
    return {
      status: intentStatus,
      failureReason: intentStatus === 'failed' ? `Payment intent status: ${paymentIntent.status}` : undefined,
      paymentIntentId: paymentIntent.id,
      chargeId: paymentIntent.latest_charge,
    };
  }

  return { status: checkoutStatus, paymentIntentId: session.payment_intent };
}

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

  let payload: VerifyGiftPaymentPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload.giftId && !payload.sessionId) {
    return jsonResponse({ error: 'giftId or sessionId is required' }, 400);
  }

  let giftQuery = serviceClient.from('card_gifts').select('*');
  if (payload.giftId) {
    giftQuery = giftQuery.eq('id', payload.giftId);
  } else {
    giftQuery = giftQuery.eq('stripe_checkout_session_id', payload.sessionId);
  }

  const { data: gift, error: giftError } = await giftQuery.maybeSingle();
  if (giftError) {
    return jsonResponse({ error: giftError.message }, 500);
  }

  if (!gift) {
    return jsonResponse({ error: 'Gift not found' }, 404);
  }

  if (gift.sender_id !== authData.user.id && gift.recipient_id !== authData.user.id) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  if (!gift.stripe_checkout_session_id) {
    return jsonResponse({
      ok: true,
      giftId: gift.id,
      status: gift.status,
      cardId: gift.card_id,
    });
  }

  try {
    const session = await stripeRequest<StripeCheckoutSession>(
      `/checkout/sessions/${gift.stripe_checkout_session_id}`,
      { method: 'GET' }
    );

    const resolved = await resolveGiftStatus(session);

    const updatePayload: Record<string, unknown> = {
      status: resolved.status,
      stripe_payment_intent_id: resolved.paymentIntentId || gift.stripe_payment_intent_id,
      stripe_charge_id: resolved.chargeId || gift.stripe_charge_id,
      failure_reason: resolved.failureReason || null,
    };

    if (resolved.paidAt) updatePayload.paid_at = resolved.paidAt;
    if (resolved.canceledAt) updatePayload.canceled_at = resolved.canceledAt;

    const { error: updateError } = await serviceClient
      .from('card_gifts')
      .update(updatePayload)
      .eq('id', gift.id);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({
      ok: true,
      giftId: gift.id,
      status: resolved.status,
      cardId: gift.card_id,
      amountCents: gift.amount_cents,
      currency: gift.currency,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not verify payment';
    return jsonResponse({ error: message }, 500);
  }
});
