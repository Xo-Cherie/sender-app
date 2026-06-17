import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-dispatch-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type DispatchPayload = {
  eventId?: string;
  processPending?: boolean;
};

type NotificationEvent = {
  id: string;
  recipient_user_id: string;
  event_type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: string;
  attempt_count: number;
};

type DevicePushToken = {
  id: string;
  expo_push_token: string;
  app_variant: string;
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

function isAuthorized(req: Request, serviceRoleKey: string | undefined) {
  const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET');
  const providedSecret = req.headers.get('X-Push-Dispatch-Secret');
  if (dispatchSecret && providedSecret === dispatchSecret) {
    return true;
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return true;
  }

  return false;
}

async function sendExpoPushMessages(messages: Array<Record<string, unknown>>) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(typeof body === 'string' ? body : JSON.stringify(body));
  }

  return body;
}

async function processEvent(serviceClient: ReturnType<typeof createClient>, event: NotificationEvent) {
  await serviceClient
    .from('notification_events')
    .update({
      status: 'processing',
      attempt_count: event.attempt_count + 1,
      last_error: null,
    })
    .eq('id', event.id);

  const { data: tokens, error: tokenError } = await serviceClient
    .from('device_push_tokens')
    .select('id, expo_push_token, app_variant')
    .eq('user_id', event.recipient_user_id)
    .eq('is_active', true);

  if (tokenError) throw new Error(tokenError.message);

  const activeTokens = (tokens || []) as DevicePushToken[];
  if (activeTokens.length === 0) {
    await serviceClient
      .from('notification_events')
      .update({
        status: 'pending',
        last_error: 'No active push tokens for recipient',
      })
      .eq('id', event.id);
    return { sent: 0, deactivated: 0, skipped: 'no_active_tokens' };
  }

  const messages = activeTokens.map((token) => ({
    to: token.expo_push_token,
    sound: 'default',
    title: event.title,
    body: event.body,
    data: {
      ...event.data,
      eventId: event.id,
      appVariant: event.data?.appVariant || token.app_variant,
    },
    priority: 'high',
    channelId: 'default',
  }));

  const expoResponse = await sendExpoPushMessages(messages);
  const tickets = Array.isArray(expoResponse?.data) ? expoResponse.data : [];
  const invalidTokenIds: string[] = [];

  tickets.forEach((ticket: any, index: number) => {
    const token = activeTokens[index];
    if (!token) return;

    const detailsError = ticket?.details?.error;
    if (
      ticket?.status === 'error' &&
      (detailsError === 'DeviceNotRegistered' || detailsError === 'InvalidCredentials')
    ) {
      invalidTokenIds.push(token.id);
    }
  });

  if (invalidTokenIds.length > 0) {
    await serviceClient
      .from('device_push_tokens')
      .update({ is_active: false })
      .in('id', invalidTokenIds);
  }

  await serviceClient
    .from('notification_events')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', event.id);

  return { sent: messages.length, deactivated: invalidTokenIds.length };
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

  if (!isAuthorized(req, serviceRoleKey)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let payload: DispatchPayload;
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const results: Array<{ eventId: string; sent?: number; deactivated?: number; error?: string }> = [];

  let events: NotificationEvent[] = [];

  if (payload.eventId) {
    const { data, error } = await serviceClient
      .from('notification_events')
      .select('*')
      .eq('id', payload.eventId)
      .maybeSingle();

    if (error) return jsonResponse({ error: error.message }, 500);
    if (data) events = [data as NotificationEvent];
  } else if (payload.processPending) {
    const { data, error } = await serviceClient
      .from('notification_events')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(25);

    if (error) return jsonResponse({ error: error.message }, 500);
    events = (data || []) as NotificationEvent[];
  } else {
    return jsonResponse({ error: 'eventId or processPending is required' }, 400);
  }

  for (const event of events) {
    if (event.status !== 'pending') continue;

    try {
      const result = await processEvent(serviceClient, event);
      results.push({ eventId: event.id, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Push delivery failed';
      await serviceClient
        .from('notification_events')
        .update({
          status: 'failed',
          last_error: message,
        })
        .eq('id', event.id);
      results.push({ eventId: event.id, error: message });
    }
  }

  return jsonResponse({ ok: true, results });
});
