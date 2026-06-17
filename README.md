# Xo Cherie

Xo Cherie is an Expo and React Native app for creating, sending, receiving, and saving digital greeting cards. The app uses Supabase for authentication and data storage, Expo Router for navigation, and a reusable library of card templates for occasions such as birthdays, weddings, holidays, thank you notes, and more.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

Create a `.env` file in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=your-supabase-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

To test Edge Functions locally, also add:

```bash
EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=http://127.0.0.1:54321/functions/v1
```

If you are testing from a physical phone, replace `127.0.0.1` with your computer's LAN IP address.

If you are testing local functions from an Android emulator, the app automatically maps `127.0.0.1` to `10.0.2.2`, which is Android's address for the host computer.

Create `supabase/functions/.env.local` from `supabase/functions/.env.example`, fill in the Supabase/Resend secrets, then run:

```bash
npm run functions:serve
```

### 2. Configure Supabase Auth Redirects

In the Supabase dashboard, open **Authentication → URL Configuration** and add these redirect URLs:

- `http://localhost:8081/auth/callback` (local web)
- `https://www.cheriecard.com/auth/callback` (production web)
- `xocherie://auth/callback` (Android/iOS builds)

Email confirmation links and magic links will land on `/auth/callback`, which completes sign-in and sends users to the app home screen.

### 3. Start the Project

- Start the development server (choose your platform):

```bash
npm run start         # Start Expo development server
npm run android       # Launch Android emulator
npm run ios           # Launch iOS simulator
npm run web           # Start the web version
```

### 4. Build Android / iOS (EAS)

EAS cloud builds use the Supabase variables in `eas.json`. Rebuild after changing them:

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform android --profile preview-device
```

Push notifications require a development/preview/production EAS build. They do not work reliably in Expo Go.

### 5. Push Notifications Setup

See the full guide: [docs/push-notifications.md](./docs/push-notifications.md)

Quick start:

```bash
npm run push:setup
npm run push:process-pending
```

Push requires an **EAS device build** (not Expo Go or web). Configure FCM (Android) and APNs (iOS) in `npx eas-cli credentials`.

### 6. Lint the Code

```bash
npm run lint
```

## Main Dependencies

- React Native: 0.81.x
- React: 19.1.x
- Expo: SDK 54
- Expo Router: ~6.x
- Supabase: ^2.50.0
- Other commonly used libraries:  
  - @expo/vector-icons  
  - react-native-paper  
  - react-native-calendars  
  - lottie-react-native  
  - react-native-webview  
  - and more

For a full list of dependencies, see [package.json](./package.json).

## Development Tools

- TypeScript: ~5.8.3
- ESLint: ^9.25.0
- @babel/core: ^7.25.2

## Contributing

1. Fork this repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is private ("private": true). For collaboration inquiries, please contact the author.

---

Feel free to add project screenshots, API documentation, feature descriptions, or any other information as needed.
