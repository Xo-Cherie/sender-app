import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const appUrl = Deno.env.get('INVITE_APP_URL') || 'https://www.cheriecard.com';
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const inviteFromEmail = Deno.env.get('INVITE_FROM_EMAIL') || 'Cherie Card <no-reply@send.cheriecard.com>';
const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
const twilioFromPhone = Deno.env.get('TWILIO_FROM_PHONE');

type InvitePayload = {
  email?: string;
  phone?: string;
  inviterName?: string;
  type?: 'friend' | 'card';
  cardId?: string;
  cardTitle?: string;
  messagePreview?: string;
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

function normalizeEmail(email?: string) {
  return email?.trim().toLowerCase() || '';
}

function normalizePhone(phone?: string) {
  return phone?.trim().replace(/[^\d+]/g, '') || '';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inviteMessage(inviterName?: string) {
  const sender = inviterName?.trim() || 'Someone';
  return `${sender} invited you to join Xo Cherie so you can send and save digital greeting cards together: ${appUrl}`;
}

function cardInviteMessage(payload: InvitePayload) {
  const sender = payload.inviterName?.trim() || 'Someone';
  const title = payload.cardTitle?.trim() || 'a card';
  return `${sender} sent you ${title} on Xo Cherie. Sign up or sign in to open it: ${appUrl}`;
}

function inviteHtml(inviterName?: string) {
  const sender = escapeHtml(inviterName?.trim() || 'Someone');
  return `
    <div style="font-family: Arial, sans-serif; color: #1A1A1A; line-height: 1.5;">
      <h2>${sender} invited you to Xo Cherie</h2>
      <p>Send and save digital greeting cards with people you care about.</p>
      <p>
        <a href="${appUrl}" style="display: inline-block; background: #C17B66; color: #FFFFFF; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">
          Join Xo Cherie
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${appUrl}">${appUrl}</a></p>
    </div>
  `;
}

function cardInviteHtml(payload: InvitePayload) {
  const sender = escapeHtml(payload.inviterName?.trim() || 'Someone');
  const title = escapeHtml(payload.cardTitle?.trim() || 'a card');
  const preview = payload.messagePreview?.trim();

  return `
    <div style="font-family: Arial, sans-serif; color: #1A1A1A; line-height: 1.5;">
      <h2>${sender} sent you ${title}</h2>
      <p>You have a new digital greeting card waiting in Xo Cherie.</p>
      ${preview ? `<blockquote style="border-left: 4px solid #C17B66; margin: 16px 0; padding-left: 12px; color: #555555;">${escapeHtml(preview)}</blockquote>` : ''}
      <p>
        <a href="${appUrl}" style="display: inline-block; background: #C17B66; color: #FFFFFF; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">
          Open Your Card
        </a>
      </p>
      <p>Use the same email address this invite was sent to. Your card will appear in your inbox after you sign in.</p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${appUrl}">${appUrl}</a></p>
    </div>
  `;
}

async function sendEmailInvite(email: string, payload: InvitePayload) {
  if (!resendApiKey) {
    return { error: 'RESEND_API_KEY is not configured' };
  }

  const isCardInvite = payload.type === 'card';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: inviteFromEmail,
      to: email,
      subject: isCardInvite ? 'You received a card on Xo Cherie' : 'Join me on Xo Cherie',
      text: isCardInvite ? cardInviteMessage(payload) : inviteMessage(payload.inviterName),
      html: isCardInvite ? cardInviteHtml(payload) : inviteHtml(payload.inviterName),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    return { error: `Resend failed: ${details}` };
  }

  return { error: null };
}

async function sendSmsInvite(phone: string, payload: InvitePayload) {
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromPhone) {
    return { error: 'SMS invites require TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE secrets' };
  }

  const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
  const body = new URLSearchParams({
    To: phone,
    From: twilioFromPhone,
    Body: payload.type === 'card' ? cardInviteMessage(payload) : inviteMessage(payload.inviterName),
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    return { error: `Twilio failed: ${details}` };
  }

  return { error: null };
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

  let payload: InvitePayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const inviterName = payload.inviterName || user.email || undefined;
  const invitePayload = {
    ...payload,
    inviterName,
  };

  if (!email && !phone) {
    return jsonResponse({ error: 'Email or phone is required' }, 400);
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return jsonResponse({ error: 'Enter a valid email address' }, 400);
    }

    const { error } = await sendEmailInvite(email, invitePayload);
    if (error) return jsonResponse({ error }, 502);
  }

  if (phone) {
    const { error } = await sendSmsInvite(phone, invitePayload);
    if (error) return jsonResponse({ error }, 502);
  }

  return jsonResponse({ ok: true });
});
