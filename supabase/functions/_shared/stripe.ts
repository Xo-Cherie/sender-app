export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function getStripeSecretKey(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (key.startsWith('pk_')) {
    throw new Error(
      'STRIPE_SECRET_KEY is set to a publishable key (pk_). Use the secret key (sk_test_... or sk_live_...) from Stripe Dashboard → Developers → API keys.'
    );
  }
  if (!key.startsWith('sk_')) {
    throw new Error(
      'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_. Check the value in Supabase → Project Settings → Edge Functions → Secrets.'
    );
  }
  return key;
}

export function isLiveStripeMode(): boolean {
  return getStripeSecretKey().startsWith('sk_live_');
}

export function getAppUrl(): string {
  return (
    Deno.env.get('STRIPE_APP_URL') ||
    Deno.env.get('INVITE_APP_URL') ||
    'http://localhost:8081'
  ).replace(/\/$/, '');
}

export async function stripeRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const secretKey = getStripeSecretKey();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };

  let body: string | undefined;
  if (options.body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(
      flattenStripeParams(options.body) as Record<string, string>
    ).toString();
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: options.method || 'POST',
    headers,
    body,
  });

  const payload = await response.json();
  if (!response.ok) {
    const message =
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : `Stripe API error (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

function flattenStripeParams(
  value: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, raw] of Object.entries(value)) {
    const paramKey = prefix ? `${prefix}[${key}]` : key;

    if (raw === undefined || raw === null) continue;

    if (typeof raw === 'object' && !Array.isArray(raw)) {
      Object.assign(result, flattenStripeParams(raw as Record<string, unknown>, paramKey));
      continue;
    }

    if (Array.isArray(raw)) {
      raw.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(
            result,
            flattenStripeParams(item as Record<string, unknown>, `${paramKey}[${index}]`)
          );
        } else {
          result[`${paramKey}[${index}]`] = String(item);
        }
      });
      continue;
    }

    result[paramKey] = String(raw);
  }

  return result;
}

export type GiftStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'payout_pending'
  | 'payout_completed'
  | 'payout_failed';

export function mapCheckoutPaymentStatus(paymentStatus: string | null | undefined): GiftStatus {
  switch (paymentStatus) {
    case 'paid':
      return 'paid';
    case 'unpaid':
      return 'pending';
    case 'no_payment_required':
      return 'paid';
    default:
      return 'processing';
  }
}

export function mapPaymentIntentStatus(status: string | null | undefined): GiftStatus {
  switch (status) {
    case 'succeeded':
      return 'paid';
    case 'processing':
    case 'requires_action':
    case 'requires_confirmation':
    case 'requires_payment_method':
      return 'processing';
    case 'canceled':
      return 'canceled';
    default:
      return 'failed';
  }
}
