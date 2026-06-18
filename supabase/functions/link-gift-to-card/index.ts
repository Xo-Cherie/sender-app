import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { corsHeaders, jsonResponse } from '../_shared/stripe.ts';

type LinkGiftToCardPayload = {
  giftId?: string;
  cardId?: string;
  recipientId?: string;
};

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

  let payload: LinkGiftToCardPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!isUuid(payload.giftId) || !isUuid(payload.cardId)) {
    return jsonResponse({ error: 'giftId and cardId are required' }, 400);
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

  if (gift.sender_id !== authData.user.id) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  if (gift.status !== 'paid') {
    return jsonResponse({ error: `Gift payment is not completed (status: ${gift.status})` }, 400);
  }

  const { data: card, error: cardError } = await serviceClient
    .from('cards')
    .select('id, sender_id')
    .eq('id', payload.cardId)
    .maybeSingle();

  if (cardError) {
    return jsonResponse({ error: cardError.message }, 500);
  }

  if (!card || card.sender_id !== authData.user.id) {
    return jsonResponse({ error: 'Card not found' }, 404);
  }

  const recipientId = isUuid(payload.recipientId) ? payload.recipientId : gift.recipient_id;

  const { error: updateError } = await serviceClient
    .from('card_gifts')
    .update({
      card_id: payload.cardId,
      recipient_id: recipientId,
    })
    .eq('id', payload.giftId);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  return jsonResponse({ ok: true, giftId: payload.giftId, cardId: payload.cardId });
});
