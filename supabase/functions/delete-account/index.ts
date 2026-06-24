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
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const userId = userData.user.id;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    await admin.from('push_tokens').delete().eq('user_id', userId);
    await admin.from('friend_requests').delete().or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
    await admin.from('friends').delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    await admin.from('received_cards').delete().eq('recipient_id', userId);
    await admin.from('user_profiles').delete().eq('id', userId);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw deleteError;
    }

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('delete-account failed:', error);
    return jsonResponse({ error: error?.message || 'Could not delete account' }, 500);
  }
});
