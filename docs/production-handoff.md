# Production Release Handoff

This document confirms release readiness for **Xo Cherie** (`com.xocherie.app`) and **Cherie Device** (`com.xocherie.device`).

## Release status

| Area | Status | Notes |
|------|--------|-------|
| Client testing fixes | Ready | Card preview layout, voice memo badge, friend tap-to-send, Inbox filter cleanup |
| Keepsakes consistency | Ready | Mobile Keepsakes tab uses saved (`isPinned`) cards |
| EAS build variants | Ready | `.easignore` excludes stale `android/`; EAS prebuild uses `app.config.js` per profile |
| Store compliance | Ready | Account deletion in Profile; permission strings in `app.config.js` |
| Backend functions | Deploy required | Run `npm run account:deploy` before store submission |

## Builds

### Internal QA (APK)

```bash
npm run lint
npm run build:android:preview
```

Install from the EAS build URL on a physical Android device.

### Production (Play Store / App Store)

```bash
npm run lint
npm run account:deploy
npm run gifts:deploy
npm run push:deploy
npm run build:android:production
npm run build:ios:production
npm run submit:android
npm run submit:ios
```

### Cherie Device variant

```bash
npx eas-cli build --platform android --profile preview-device
npx eas-cli build --platform android --profile production-device
```

## Pre-submission QA checklist

### Sender app (Xo Cherie)

- [ ] Sign up, sign in, sign out, password reset
- [ ] Create card end-to-end: template → recipients → message → photo → voice memo → preview → send
- [ ] Preview shows no overlapping text; voice memo badge visible when attached
- [ ] Tap friend in Friends list → opens create flow with friend preselected
- [ ] Inbox shows All / Unread only (no Pinned filter)
- [ ] Save card to Keepsakes → appears in Keepsakes tab
- [ ] Delete account from Profile (test with throwaway account)

### Receiver (Cherie Device or card detail)

- [ ] Open card, flip, play voice memo
- [ ] Save to Keepsakes, confirm in Keepsakes screen
- [ ] Send Xo acknowledgment

## App Store / Play review notes

**Test account:** Provide a reviewer login in App Store Connect / Play Console.

**Account deletion:** Profile → Delete Account (permanent).

**Permissions:**

- Microphone — voice memos on cards
- Photo library — card photos and profile avatar
- Notifications — new card alerts (optional)

**Encryption:** `ITSAppUsesNonExemptEncryption` is `false` in `app.config.js`.

**Privacy policy & support URLs:** Required in both stores (use `https://www.cheriecard.com`).

## Known build notes

1. **338 MB upload warning:** `.easignore` reduces archive size by excluding `android/`, docs, and local caches. EAS regenerates native projects via `prebuildCommand`.
2. **`android.package` ignored:** If `android/` is present locally, EAS uses it. Production builds should rely on EAS prebuild (`.easignore` handles this).
3. **Supabase secrets:** Gift, push, and delete-account functions need production secrets in the Supabase dashboard.

## Fixes included in this stabilization pass

1. **Card preview overlap** — `FlipCard` compact layout with line limits
2. **Voice memo in preview** — mic badge on card back during create/preview
3. **Friends arrows** — tap friend row to start card for that friend
4. **Pinned vs Keepsakes** — removed redundant Inbox Pinned filter; Keepsakes uses saved cards
5. **Debug cleanup** — removed render `console.log` from card detail
6. **Account deletion** — Profile + `delete-account` edge function
7. **Demo badge removed** — Profile no longer shows "V1.0 Demo Mode"

## Handoff confirmation

- **App version:** 1.0.0
- **EAS project:** `@rdoug555s-team/xocherie`
- **Bundle IDs:** `com.xocherie.app`, `com.xocherie.device`
- **Production URL:** https://www.cheriecard.com
- **Supabase project:** kaxmrthocgmpfbsbvpge

**Recommended next step:** Run `npm run build:android:preview` and send the new APK to the client for final sign-off before `production` store submission.
