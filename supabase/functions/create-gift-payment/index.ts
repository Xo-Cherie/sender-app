import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import {
  corsHeaders,
  getStripeSecretKey,
  jsonResponse,
  mapCheckoutPaymentStatus,
  resolveGiftPaymentRedirectPath,
  stripeRequest,
} from '../_shared/stripe.ts';

type CreateGiftPaymentPayload = {
  amountCents?: number;
  currency?: string;
  recipientId?: string;
  recipientEmail?: string;
  giftMessage?: string;
  redirectPath?: string;
};

function normalizeEmail(email?: string) {
  return email?.trim().toLowerCase() || '';
}

function isUuid(value?: string) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    getStripeSecretKey();
  } catch (configError) {
    const message =
      configError instanceof Error
        ? configError.message
        : 'STRIPE_SECRET_KEY is not configured';
    return jsonResponse(
      {
        error: `${message} After updating secrets, redeploy with: npm run gifts:deploy`,
        code: 'STRIPE_NOT_CONFIGURED',
      },
      503
    );
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

  let payload: CreateGiftPaymentPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const amountCents = Math.round(Number(payload.amountCents || 0));
  const currency = (payload.currency || 'usd').toLowerCase();
  const recipientId = isUuid(payload.recipientId) ? payload.recipientId : null;
  const recipientEmail = normalizeEmail(payload.recipientEmail);
  const giftMessage = payload.giftMessage?.trim() || 'Enjoy your gift!';

  if (amountCents < 50 || amountCents > 1_000_000) {
    return jsonResponse({ error: 'Gift amount must be between $0.50 and $10,000.00' }, 400);
  }

  if (!recipientId && !recipientEmail) {
    return jsonResponse({ error: 'A recipient friend or email is required for monetary gifts' }, 400);
  }

  if (recipientId === authData.user.id) {
    return jsonResponse({ error: 'You cannot send a monetary gift to yourself' }, 400);
  }

  if (recipientId) {
    const { data: recipientProfile, error: recipientError } = await serviceClient
      .from('user_profiles')
      .select('id, email')
      .eq('id', recipientId)
      .maybeSingle();

    if (recipientError) {
      return jsonResponse({ error: recipientError.message }, 500);
    }

    if (!recipientProfile) {
      return jsonResponse({ error: 'Recipient account not found' }, 400);
    }
  }

  const { data: giftRow, error: giftInsertError } = await serviceClient
    .from('card_gifts')
    .insert({
      sender_id: authData.user.id,
      recipient_id: recipientId,
      recipient_email: recipientEmail || null,
      amount_cents: amountCents,
      currency,
      gift_message: giftMessage,
      status: 'pending',
      metadata: {
        created_from: 'create-gift-payment',
      },
    })
    .select('id')
    .single();

  if (giftInsertError || !giftRow) {
    const message = giftInsertError?.message || 'Could not create gift record';
    const hint = message.includes('card_gifts')
      ? ' Run supabase db push to create the card_gifts table.'
      : '';
    return jsonResponse({ error: `${message}${hint}` }, 500);
  }

  const giftId = giftRow.id as string;
  const giftPaymentPath = resolveGiftPaymentRedirectPath(payload.redirectPath);

  try {
    const session = await stripeRequest<{
      id: string;
      url: string | null;
      payment_intent: string | null;
    }>('/checkout/sessions', {
      body: {
        mode: 'payment',
        success_url: `${giftPaymentPath}?status=success&session_id={CHECKOUT_SESSION_ID}&gift_id=${giftId}`,
        cancel_url: `${giftPaymentPath}?status=canceled&gift_id=${giftId}`,
        client_reference_id: giftId,
        metadata: {
          gift_id: giftId,
          sender_id: authData.user.id,
          recipient_id: recipientId || '',
          recipient_email: recipientEmail || '',
        },
        line_items: [
          {
            price_data: {
              currency,
              unit_amount: amountCents,
              product_data: {
                name: 'Cherie Card Monetary Gift',
                description: giftMessage,
              },
            },
            quantity: 1,
          },
        ],
      },
    });

    const mappedStatus = mapCheckoutPaymentStatus('unpaid');

    const { error: updateError } = await serviceClient
      .from('card_gifts')
      .update({
        status: mappedStatus,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent,
      })
      .eq('id', giftId);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({
      ok: true,
      giftId,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      status: mappedStatus,
      livemode: Deno.env.get('STRIPE_SECRET_KEY')?.startsWith('sk_live_') ?? false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe checkout failed';
    await serviceClient
      .from('card_gifts')
      .update({
        status: 'failed',
        failure_reason: message,
      })
      .eq('id', giftId);

    return jsonResponse({ error: message }, 500);
  }
});
