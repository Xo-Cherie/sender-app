import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/contexts/AuthContext';
import { PushNotificationProvider } from '@/components/PushNotificationProvider';
import { AuthRecoveryRedirect } from '@/components/AuthRecoveryRedirect';
import { CardsProvider } from '@/hooks/useCards';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthRecoveryRedirect />
        <PushNotificationProvider>
          <CardsProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="reset-password" options={{ headerShown: true, title: 'Reset Password' }} />
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
          <Stack.Screen name="gift-payment" options={{ headerShown: true, title: 'Gift Payment' }} />
          <Stack.Screen name="gift-history" options={{ headerShown: false }} />
          <Stack.Screen name="gift-payout-setup" options={{ headerShown: true, title: 'Payout Setup' }} />
          </Stack>
          </CardsProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
