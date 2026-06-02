import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="mfa-verify" />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen 
            name="card-detail" 
            options={{ 
              headerShown: true,
              title: 'Card',
              headerBackTitle: 'Back',
            }} 
          />
          <Stack.Screen 
            name="create-card/index"
            options={{ 
              headerShown: true,
              title: 'New Card',
              headerBackTitle: 'Cancel',
            }} 
          />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
