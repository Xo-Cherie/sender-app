import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import {
  corsHeaders,
  jsonResponse,
  mapCheckoutPaymentStatus,
  mapPaymentIntentStatus,
  stripeRequest,
  type GiftStatus,
} from '../_shared/stripe.ts';

async function verifyStripeSignature(payload: string, signatureHeader: string | null) {
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim();
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  if (!signatureHeader) {
    throw new Error('Missing stripe-signature header');
  }

  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    throw new Error('Invalid stripe-signature header');
  }

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  if (expected !== signature) {
    throw new Error('Invalid webhook signature');
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (Number.isFinite(ageSeconds) && ageSeconds > 300) {
    throw new Error('Webhook timestamp outside tolerance');
  }
}

async function updateGiftById(
  serviceClient: ReturnType<typeof createClient>,
  giftId: string,
  update: Record<string, unknown>
) {
  const { error } = await serviceClient.from('card_gifts').update(update).eq('id', giftId);
  if (error) throw new Error(error.message);
}

async function updateGiftBySessionId(
  serviceClient: ReturnType<typeof createClient>,
  sessionId: string,
  update: Record<string, unknown>
) {
  const { error } = await serviceClient
    .from('card_gifts')
    .update(update)
    .eq('stripe_checkout_session_id', sessionId);
  if (error) throw new Error(error.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }

  const payload = await req.text();

  try {
    await verifyStripeSignature(payload, req.headers.get('stripe-signature'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook verification failed';
    return jsonResponse({ error: message }, 400);
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: Record<string, unknown> };
  };

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const giftId = String(session.metadata?.gift_id || session.client_reference_id || '');
        const paymentStatus = String(session.payment_status || '');
        const status: GiftStatus = mapCheckoutPaymentStatus(paymentStatus);
        const update = {
          status,
          stripe_payment_intent_id: session.payment_intent || null,
          paid_at: status === 'paid' ? new Date().toISOString() : null,
          failure_reason: null,
        };

        if (giftId) {
          await updateGiftById(serviceClient, giftId, update);
        } else if (session.id) {
          await updateGiftBySessionId(serviceClient, String(session.id), update);
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        const giftId = String(session.metadata?.gift_id || session.client_reference_id || '');
        const update = {
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          failure_reason: 'Checkout session expired',
        };
        if (giftId) {
          await updateGiftById(serviceClient, giftId, update);
        } else if (session.id) {
          await updateGiftBySessionId(serviceClient, String(session.id), update);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const status: GiftStatus = mapPaymentIntentStatus(String(paymentIntent.status || 'failed'));
        const update = {
          status,
          stripe_payment_intent_id: paymentIntent.id,
          failure_reason:
            (paymentIntent.last_payment_error as { message?: string } | undefined)?.message ||
            'Payment failed',
        };
        const { error } = await serviceClient
          .from('card_gifts')
          .update(update)
          .eq('stripe_payment_intent_id', String(paymentIntent.id));
        if (error) throw new Error(error.message);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        const update = {
          status: 'refunded',
          failure_reason: 'Payment refunded',
        };
        const { error } = await serviceClient
          .from('card_gifts')
          .update(update)
          .eq('stripe_charge_id', String(charge.id));
        if (error) throw new Error(error.message);
        break;
      }
      default:
        break;
    }

    return jsonResponse({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler failed';
    return jsonResponse({ error: message }, 500);
  }
});
