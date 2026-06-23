import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import type { CardGiftTransaction, GiftPaymentStatus, StripeConnectStatus } from '@/types';

const MIN_GIFT_CENTS = 50;
const MAX_GIFT_CENTS = 1_000_000;

export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToDollars(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

export function validateGiftAmount(amount: number): string | null {
  const cents = dollarsToCents(amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Enter a valid gift amount';
  }
  if (cents < MIN_GIFT_CENTS) {
    return 'Minimum gift amount is $0.50';
  }
  if (cents > MAX_GIFT_CENTS) {
    return 'Maximum gift amount is $10,000.00';
  }
  return null;
}

export function getGiftStatusLabel(status: GiftPaymentStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending payment';
    case 'processing':
      return 'Processing';
    case 'paid':
      return 'Paid';
    case 'failed':
      return 'Failed';
    case 'canceled':
      return 'Canceled';
    case 'refunded':
      return 'Refunded';
    case 'payout_pending':
      return 'Payout processing';
    case 'payout_completed':
      return 'Payout sent';
    case 'payout_failed':
      return 'Payout failed';
    default:
      return status;
  }
}

export function isGiftPaymentComplete(status?: GiftPaymentStatus): boolean {
  return status === 'paid' || status === 'payout_pending' || status === 'payout_completed';
}

function getAppReturnUrl(path: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }

  // Native checkout must return to the app deep link, not the public website.
  if (path.startsWith('/gift-payment')) {
    const params = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '');
    const record: Record<string, string> = {};
    params.forEach((value, key) => {
      record[key] = value;
    });
    return buildGiftPaymentReturnUrl(record);
  }

  const configured = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) {
    return `${configured}${path}`;
  }

  return `http://localhost:8081${path}`;
}

/** Stripe return path after checkout — web URL or native deep link (xocherie://gift-payment). */
export function getGiftPaymentRedirectPath(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin.replace(/\/$/, '')}/gift-payment`;
  }
  return Linking.createURL('gift-payment');
}

function buildGiftPaymentReturnUrl(params: Record<string, string>): string {
  const path = getGiftPaymentRedirectPath();
  const query = new URLSearchParams(params).toString();
  return query ? `${path}?${query}` : path;
}

export async function createGiftPayment(input: {
  amountCents: number;
  recipientId?: string;
  recipientEmail?: string;
  giftMessage?: string;
}) {
  return invokeEdgeFunction<{
    ok: boolean;
    giftId: string;
    checkoutSessionId: string;
    checkoutUrl: string;
    status: GiftPaymentStatus;
    livemode: boolean;
    error?: string;
  }>('create-gift-payment', {
    body: {
      ...input,
      redirectPath: getGiftPaymentRedirectPath(),
    },
  });
}

export async function verifyGiftPayment(input: { giftId?: string; sessionId?: string }) {
  return invokeEdgeFunction<{
    ok: boolean;
    giftId: string;
    status: GiftPaymentStatus;
    cardId?: string;
    amountCents?: number;
    currency?: string;
    error?: string;
  }>('verify-gift-payment', { body: input });
}

export async function linkGiftToCard(input: {
  giftId: string;
  cardId: string;
  recipientId?: string;
}) {
  return invokeEdgeFunction<{ ok: boolean; giftId: string; cardId: string; error?: string }>(
    'link-gift-to-card',
    { body: input }
  );
}

export async function claimGiftPayout(giftId: string) {
  return invokeEdgeFunction<{
    ok: boolean;
    status: GiftPaymentStatus;
    transferId?: string;
    amountCents?: number;
    currency?: string;
    needsOnboarding?: boolean;
    alreadyClaimed?: boolean;
    error?: string;
  }>('claim-gift-payout', { body: { giftId } });
}

export async function startConnectOnboarding() {
  return invokeEdgeFunction<{
    ok: boolean;
    onboardingUrl: string;
    connectAccountId: string;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    error?: string;
  }>('create-connect-onboarding', { body: {} });
}

export function parseStripeReturnParams(url: string): Record<string, string> {
  const normalized = url.replace(/^([a-z][a-z0-9+.-]*):\/\//i, 'https://auth.local/');
  try {
    const parsed = new URL(normalized);
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}

export async function openStripeCheckout(checkoutUrl: string, giftId: string) {
  const returnUrl = getAppReturnUrl(`/gift-payment?gift_id=${giftId}`);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.location.assign(checkoutUrl);
    }
    return { type: 'web_redirect' as const };
  }

  const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, returnUrl);
  return result;
}

export async function openConnectOnboarding(onboardingUrl: string) {
  const returnUrl = getAppReturnUrl('/gift-payout-setup?status=complete');

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.location.assign(onboardingUrl);
    }
    return { type: 'web_redirect' as const };
  }

  return WebBrowser.openAuthSessionAsync(onboardingUrl, returnUrl);
}

export function mapGiftRow(
  row: Record<string, unknown>,
  direction: 'sent' | 'received'
): CardGiftTransaction {
  return {
    id: String(row.id),
    cardId: row.card_id ? String(row.card_id) : undefined,
    senderId: String(row.sender_id),
    recipientId: row.recipient_id ? String(row.recipient_id) : undefined,
    recipientEmail: row.recipient_email ? String(row.recipient_email) : undefined,
    amountCents: Number(row.amount_cents || 0),
    currency: String(row.currency || 'usd'),
    giftMessage: row.gift_message ? String(row.gift_message) : undefined,
    status: String(row.status) as GiftPaymentStatus,
    failureReason: row.failure_reason ? String(row.failure_reason) : undefined,
    paidAt: row.paid_at ? String(row.paid_at) : undefined,
    claimedAt: row.claimed_at ? String(row.claimed_at) : undefined,
    payoutCompletedAt: row.payout_completed_at ? String(row.payout_completed_at) : undefined,
    createdAt: String(row.created_at),
    direction,
  };
}

export function mapConnectRow(row: Record<string, unknown> | null | undefined): StripeConnectStatus {
  if (!row) {
    return {
      onboardingComplete: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
  }

  return {
    connectAccountId: row.stripe_connect_account_id
      ? String(row.stripe_connect_account_id)
      : undefined,
    onboardingComplete: Boolean(row.onboarding_complete),
    payoutsEnabled: Boolean(row.payouts_enabled),
    detailsSubmitted: Boolean(row.details_submitted),
  };
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_STRIPE_ENABLED !== 'false');
}

export function isStripeLiveMode(): boolean {
  const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  return key.startsWith('pk_live_');
}
