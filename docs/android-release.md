# Android Release Checklist

## App identity

| Field | Main app | Device app |
|-------|----------|------------|
| Name | Xo Cherie | Cherie Device |
| Package | `com.xocherie.app` | `com.xocherie.device` |
| Deep link | `xocherie://` | `cheriedevice://` |
| EAS profile | `production` | `production-device` |
| QA profile | `preview` (APK) | `preview-device` (APK) |

## Before building

```bash
npm run lint
npm run account:deploy
```

Confirm EAS environment variables for `production`:

- `EXPO_PUBLIC_APP_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Build commands

```bash
# QA APK for client testing
npm run build:android:preview

# Play Store AAB
npm run build:android:production

# Device variant APK/AAB
npx eas-cli build --platform android --profile production-device
```

## Submit to Google Play

```bash
npm run submit:android
```

Or upload the AAB manually in Play Console.

## Play Console listing

- **Category:** Lifestyle or Social
- **Privacy policy URL:** required
- **Data safety:** declare account info, photos, audio (voice memos), and messages
- **Permissions justification:**
  - `RECORD_AUDIO` — voice memos on greeting cards
  - `READ_MEDIA_IMAGES` — attach photos to cards
  - `POST_NOTIFICATIONS` — new card alerts

## Common review feedback responses

| Feedback | Response / fix |
|----------|----------------|
| Account deletion missing | Profile → Delete Account |
| Misleading permissions | Only request mic/photos when user attaches media |
| App crashes on launch | Verify EAS env vars; rebuild with `preview` profile |
| Wrong app name on APK | Ensure `.easignore` excludes `android/` so prebuild uses correct variant |

## Physical device QA

Test on at least one Android phone (not emulator):

1. Install preview APK from EAS link
2. Create card with photo + voice memo; confirm preview layout
3. Send to test recipient
4. Tap friend → create card flow
5. Save card to Keepsakes; verify Keepsakes tab
6. Delete throwaway test account

## Re-submit after rejection

1. Fix the issue in code
2. `npm run lint`
3. `npm run build:android:production`
4. Upload new AAB and reply in Play Console with what changed
