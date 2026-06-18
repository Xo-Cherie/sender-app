import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { corsHeaders, getAppUrl, jsonResponse, stripeRequest } from '../_shared/stripe.ts';

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

  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select('email, first_name, last_name')
    .eq('id', authData.user.id)
    .maybeSingle();

  const email = profile?.email || authData.user.email || undefined;
  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
    authData.user.user_metadata?.display_name ||
    'Cherie User';

  const { data: existing } = await serviceClient
    .from('user_stripe_connect')
    .select('*')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  let connectAccountId = existing?.stripe_connect_account_id as string | undefined;

  if (!connectAccountId) {
    const account = await stripeRequest<{ id: string }>('/accounts', {
      body: {
        type: 'express',
        email,
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          user_id: authData.user.id,
        },
      },
    });

    connectAccountId = account.id;

    const { error: insertError } = await serviceClient.from('user_stripe_connect').upsert({
      user_id: authData.user.id,
      stripe_connect_account_id: connectAccountId,
      onboarding_complete: false,
      payouts_enabled: false,
      details_submitted: false,
    });

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
    }
  }

  const appUrl = getAppUrl();
  const accountLink = await stripeRequest<{ url: string }>('/account_links', {
    body: {
      account: connectAccountId,
      refresh_url: `${appUrl}/gift-payout-setup?status=refresh`,
      return_url: `${appUrl}/gift-payout-setup?status=complete`,
      type: 'account_onboarding',
    },
  });

  const account = await stripeRequest<{
    details_submitted: boolean;
    payouts_enabled: boolean;
  }>(`/accounts/${connectAccountId}`, { method: 'GET' });

  await serviceClient
    .from('user_stripe_connect')
    .update({
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
      onboarding_complete: account.details_submitted && account.payouts_enabled,
    })
    .eq('user_id', authData.user.id);

  return jsonResponse({
    ok: true,
    onboardingUrl: accountLink.url,
    connectAccountId,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  });
});
