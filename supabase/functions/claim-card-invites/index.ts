import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
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
  const authHeader = req.headers.get('Authorization');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user?.email) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: matchedCardIds, error: cardsError } = await serviceClient.rpc(
    'find_cards_for_invite_email',
    { p_email: normalizedEmail }
  );

  if (cardsError) {
    return jsonResponse({ error: cardsError.message }, 500);
  }

  const cardIds = (matchedCardIds || []).filter(Boolean);
  if (cardIds.length === 0) {
    return jsonResponse({ ok: true, claimed: 0 });
  }

  const { data: existingRows, error: existingError } = await serviceClient
    .from('received_cards')
    .select('card_id')
    .eq('recipient_id', user.id)
    .in('card_id', cardIds);

  if (existingError) {
    return jsonResponse({ error: existingError.message }, 500);
  }

  const existingCardIds = new Set((existingRows || []).map((row: any) => row.card_id));
  const rowsToInsert = cardIds
    .filter((cardId: string) => !existingCardIds.has(cardId))
    .map((cardId: string) => ({
      card_id: cardId,
      recipient_id: user.id,
      is_read: false,
      is_pinned: false,
    }));

  if (rowsToInsert.length === 0) {
    return jsonResponse({ ok: true, claimed: 0 });
  }

  const { error: insertError } = await serviceClient
    .from('received_cards')
    .insert(rowsToInsert);

  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500);
  }

  return jsonResponse({ ok: true, claimed: rowsToInsert.length });
});
