import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RegisterPayload = {
  action?: 'register' | 'unregister';
  expoPushToken?: string;
  platform?: string;
  appVariant?: string;
  deviceId?: string;
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

function normalizePlatform(value?: string) {
  if (value === 'ios' || value === 'android' || value === 'web') return value;
  return 'android';
}

function normalizeAppVariant(value?: string) {
  return value === 'device' ? 'device' : 'main';
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
  const authHeader = req.headers.get('Authorization');

  if (!supabaseUrl || !supabaseAnonKey || !authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let payload: RegisterPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const action = payload.action || 'register';
  const expoPushToken = payload.expoPushToken?.trim();

  if (!expoPushToken) {
    return jsonResponse({ error: 'expoPushToken is required' }, 400);
  }

  if (action === 'unregister') {
    const { error } = await supabase
      .from('device_push_tokens')
      .update({ is_active: false, last_seen_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('expo_push_token', expoPushToken);

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true });
  }

  const { error } = await supabase
    .from('device_push_tokens')
    .upsert(
      {
        user_id: user.id,
        expo_push_token: expoPushToken,
        platform: normalizePlatform(payload.platform),
        app_variant: normalizeAppVariant(payload.appVariant),
        device_id: payload.deviceId || null,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'expo_push_token' }
    );

  if (error) return jsonResponse({ error: error.message }, 500);

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET');
  let pendingDispatched = 0;

  if (serviceRoleKey && dispatchSecret) {
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: pendingEvents } = await serviceClient
      .from('notification_events')
      .select('id')
      .eq('recipient_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(25);

    const dispatchUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

    for (const event of pendingEvents || []) {
      try {
        const response = await fetch(dispatchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Push-Dispatch-Secret': dispatchSecret,
          },
          body: JSON.stringify({ eventId: event.id }),
        });
        if (response.ok) pendingDispatched += 1;
      } catch {
        // Non-fatal: token registration succeeded; dispatch can be retried later.
      }
    }
  }

  return jsonResponse({ ok: true, pendingDispatched });
});
