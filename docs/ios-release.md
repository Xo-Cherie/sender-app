# iOS Release Checklist

This checklist is for the default Xo Cherie iOS app.

## App Identity

- App name: Xo Cherie
- Bundle ID: `com.xocherie.app`
- EAS project: `@rdoug555s-team/xocherie`
- EAS project ID: `22406cb6-5917-4bb4-a86f-123e5913ef1a`
- Version: `1.0.0`
- Build profile: `production`

## Apple Developer Setup

Complete these in Apple Developer and App Store Connect before building for TestFlight:

- Confirm the Apple Developer Program membership is active.
- Create or verify the explicit App ID `com.xocherie.app`.
- Create the App Store Connect app record for Xo Cherie.
- Give the EAS operator access to the Apple team, or run the EAS credential setup from an interactive terminal.
- Use EAS-managed signing credentials unless an existing distribution certificate and provisioning profile must be imported.

Interactive credential setup:

```bash
npx eas-cli credentials:configure-build --platform ios --profile production
```

## Build And Submit

After iOS credentials are configured:

```bash
npm run lint
npx expo config --type public
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```

If `eas submit` prompts for App Store Connect details, provide the App Store Connect app ID, Apple team ID, Apple ID, or an App Store Connect API key with App Manager access.

## TestFlight

- Wait for App Store Connect processing to finish.
- Add an internal tester group.
- Add internal testers by Apple ID email.
- Assign the latest processed build to the group.
- Confirm testers can install the build through TestFlight.

## iOS Device QA

Validate on at least one physical iPhone:

- Sign up, sign in, sign out, and password reset.
- Open Supabase email/magic-link redirects through `xocherie://auth/callback`.
- Create and save a greeting card.
- Pick photos from the library and upload them.
- Record, upload, and play a voice memo.
- Update profile fields and avatar.
- Confirm denied microphone/photo permissions show recoverable UI.
- Confirm app launch, navigation, and card detail screens work after force close/reopen.

## App Store Connect Listing

Prepare these assets before review submission:

- App name: Xo Cherie
- Subtitle: Digital greeting cards for every occasion
- Category: Lifestyle or Social Networking
- Description: Explain that users create, personalize, send, receive, and save digital greeting cards with photos and optional voice memos.
- Keywords: greeting cards, cards, birthday, wedding, thank you, holidays, keepsakes, messages
- Support URL: required
- Privacy Policy URL: required
- Marketing URL: optional
- Screenshots: required for each selected iPhone display size
- Review notes: include a test account, key test steps, and any backend requirements

## Compliance Notes

- Encryption: `ITSAppUsesNonExemptEncryption` is set to `false`; update this if the app adds custom or non-exempt encryption.
- Photo library permission: used for choosing card images and profile avatars.
- Microphone permission: used for recording voice memos for cards.
- Data collection: document Supabase-backed account data, profile data, uploaded media, and authentication identifiers in App Privacy.
- Account deletion: Apple requires apps with account creation to provide account deletion access or clear review notes explaining the flow.

