# Push Notifications — Full Setup & Test Guide

Push uses **Expo Push** (mobile) + **Supabase** (tokens, events, delivery). **Web does not receive push** in this app.

## Architecture

```
App (EAS build) → register-push-token → device_push_tokens
Card / friend / Xo → notification_events (DB trigger)
notification_events INSERT → pg_net → send-push-notification → Expo Push API → FCM/APNs → device
```

---

## Step 1 — Firebase Cloud Messaging (Android)

1. [Firebase Console](https://console.firebase.google.com/) → project (e.g. `xo-cherie-device`)
2. Add Android app:
   - Main: `com.xocherie.app`
   - Device variant: `com.xocherie.device`
3. **Project settings → Service accounts → Generate new private key** (JSON)
4. Save JSON securely (never commit to git)

---

## Step 2 — Apple Push Notification service (iOS)

1. [Apple Developer](https://developer.apple.com/account) → **Keys** → **+**
2. Enable **Apple Push Notifications service (APNs)**
3. Download `.p8` file (once only); note **Key ID** and **Team ID**
4. Register App IDs with Push enabled:
   - `com.xocherie.app`
   - `com.xocherie.device` (if shipping device app)

---

## Step 3 — EAS credentials

```powershell
npx eas-cli credentials
```

- **Android** → upload Firebase service account JSON (FCM v1)
- **iOS** → upload APNs `.p8` + Key ID + Team ID

Build installable apps (push does **not** work in Expo Go or web):

```powershell
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile preview-device
npx eas-cli build --platform ios --profile preview
```

---

## Step 4 — Supabase backend

```powershell
$env:SUPABASE_DB_PASSWORD = "your-db-password"
$env:PUSH_DISPATCH_SECRET = "your-random-secret"

npm run push:setup
```

Or manually:

```powershell
supabase db push --yes
supabase secrets set PUSH_DISPATCH_SECRET=your-random-secret
supabase functions deploy register-push-token
supabase functions deploy send-push-notification
```

**SQL Editor** (replace secret and anon key):

```sql
insert into public.notification_dispatch_config (id, dispatch_url, dispatch_secret, dispatch_anon_key)
values (
  1,
  'https://kaxmrthocgmpfbsbvpge.supabase.co/functions/v1/send-push-notification',
  'your-random-secret',
  'your-supabase-anon-key'
)
on conflict (id) do update set
  dispatch_url = excluded.dispatch_url,
  dispatch_secret = excluded.dispatch_secret,
  dispatch_anon_key = excluded.dispatch_anon_key,
  updated_at = timezone('utc', now());
```

Flush backlog:

```powershell
npm run push:process-pending
```

---

## Step 5 — Device test checklist

1. Install **EAS preview** APK/IPA on a **physical device**
2. Sign in → tap **Allow** notifications
3. Supabase → `device_push_tokens` → row with `ExponentPushToken[...]`
4. [Expo Push Tool](https://expo.dev/notifications) → send test to that token
5. Send card / friend request / Xo from another account
6. Test **foreground**, **background**, **killed** + tap navigation

| Event | Tap opens |
|-------|-----------|
| `card_received` | Inbox (main) or `/device/card/[id]` (device) |
| `friend_request` | Friends (main) or device home |
| `xo_received` | Card detail (sent view) |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No token in DB | EAS build + real device; not web/Expo Go |
| Events stay `pending` | Run `npm run push:process-pending`; check `notification_dispatch_config` |
| `InvalidCredentials` from Expo | Re-upload FCM/APNs in EAS; rebuild app |
| `No active push tokens` | Normal until device registers; stays pending for retry |
| Web | Push intentionally disabled |

---

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run push:setup` | Deploy functions, print SQL config |
| `npm run push:process-pending` | Flush pending `notification_events` |
| `npm run push:deploy` | Redeploy both push Edge Functions |
