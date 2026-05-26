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

function inviteMessage(inviterName?: string) {
  const sender = inviterName?.trim() || 'Someone';
  return `${sender} invited you to join Xo Cherie so you can send and save digital greeting cards together: ${appUrl}`;
}

function inviteHtml(inviterName?: string) {
  const sender = inviterName?.trim() || 'Someone';
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

async function sendEmailInvite(email: string, inviterName?: string) {
  if (!resendApiKey) {
    return { error: 'RESEND_API_KEY is not configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: inviteFromEmail,
      to: email,
      subject: 'Join me on Xo Cherie',
      text: inviteMessage(inviterName),
      html: inviteHtml(inviterName),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    return { error: `Resend failed: ${details}` };
  }

  return { error: null };
}

async function sendSmsInvite(phone: string, inviterName?: string) {
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromPhone) {
    return { error: 'SMS invites require TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE secrets' };
  }

  const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
  const body = new URLSearchParams({
    To: phone,
    From: twilioFromPhone,
    Body: inviteMessage(inviterName),
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

  if (!email && !phone) {
    return jsonResponse({ error: 'Email or phone is required' }, 400);
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return jsonResponse({ error: 'Enter a valid email address' }, 400);
    }

    const { error } = await sendEmailInvite(email, inviterName);
    if (error) return jsonResponse({ error }, 500);
  }

  if (phone) {
    const { error } = await sendSmsInvite(phone, inviterName);
    if (error) return jsonResponse({ error }, 500);
  }

  return jsonResponse({ ok: true });
});
