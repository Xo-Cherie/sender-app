# Stripe Monetary Gifts

Monetary gifts use **Stripe Checkout** for sender payments and **Stripe Connect Express** for recipient payouts. Payment status is tracked in Supabase (`card_gifts`).

## Architecture

```
Sender (create-card)
  → create-gift-payment (Edge Function)
  → Stripe Checkout
  → stripe-webhook / verify-gift-payment
  → card_gifts.status = paid
  → sendCard + link-gift-to-card

Recipient (card-detail / profile)
  → create-connect-onboarding (Stripe Connect)
  → claim-gift-payout (Stripe Transfer)
  → card_gifts.status = payout_completed
```

## Step 1 — Stripe sandbox keys

1. Create a [Stripe account](https://dashboard.stripe.com/register)
2. Enable **Connect** in Dashboard → Connect settings
3. Copy **test** keys:
   - `sk_test_...` → server secret
   - `pk_test_...` → client publishable (optional display)

## Step 2 — Supabase secrets

```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_APP_URL=http://localhost:8081
```

Also set in `supabase/functions/.env.local` for local function testing.

## Step 3 — Database migration

```powershell
$env:SUPABASE_DB_PASSWORD = "your-db-password"
supabase db push --yes
```

Creates:
- `card_gifts` — payment + payout status
- `user_stripe_connect` — recipient Connect accounts

## Step 4 — Deploy Edge Functions

```powershell
npm run gifts:deploy
```

Functions:
| Function | JWT | Purpose |
|----------|-----|---------|
| `create-gift-payment` | yes | Start Stripe Checkout |
| `verify-gift-payment` | yes | Confirm payment after redirect |
| `stripe-webhook` | no | Authoritative payment events |
| `create-connect-onboarding` | yes | Recipient payout setup |
| `claim-gift-payout` | yes | Transfer gift to recipient |
| `link-gift-to-card` | yes | Attach paid gift to sent card |

## Step 5 — Stripe webhook (sandbox)

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
3. Events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

## Step 6 — Client env (.env)

```env
EXPO_PUBLIC_STRIPE_ENABLED=true
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_APP_URL=http://localhost:8081
```

## Step 7 — Sandbox test flow

1. Start app: `npm run start`
2. Create card → add **$5.00** gift → one recipient only
3. Send → complete Stripe Checkout with test card `4242 4242 4242 4242`
4. Confirm card appears in Outbox with paid gift
5. Recipient: Profile → **Set Up Gift Payouts** → complete Connect onboarding (test mode)
6. Recipient: open card → **Claim Gift Payout**
7. Profile → **Gift Transaction History** → verify sent/received statuses

### Payment statuses

| Status | Meaning |
|--------|---------|
| `pending` | Checkout started |
| `processing` | Payment in progress |
| `paid` | Sender payment succeeded |
| `failed` | Payment failed |
| `canceled` | Checkout canceled/expired |
| `refunded` | Charge refunded |
| `payout_pending` | Transfer in progress |
| `payout_completed` | Recipient paid out |
| `payout_failed` | Transfer failed |

## Step 8 — Live credentials

1. Complete Stripe business verification
2. Replace secrets with live keys:
   ```powershell
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_...
   ```
3. Set `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` in EAS env
4. Create **live** webhook endpoint (same events)
5. Rebuild app with production profile

## Security notes

- Secret keys only in Supabase Edge Function secrets (never in client)
- Webhook signature verification required
- Gift writes go through Edge Functions (service role)
- RLS: users read only their sent/received gifts
- Sender must complete payment before card send (`link-gift-to-card` validates `paid`)
- Recipients must complete Connect onboarding before payout

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "STRIPE_SECRET_KEY is not configured" | Set Supabase secret + redeploy functions |
| Payment succeeds but card not sent (web) | Check `gift-payment` route + sessionStorage pending draft |
| Payout fails | Ensure Connect onboarding complete + platform balance covers transfer |
| Multiple recipients with gift | Only one recipient allowed for monetary gifts |
