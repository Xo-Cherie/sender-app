import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!password || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError);
        return;
      }
      setSuccess(true);
      const loginPath = process.env.EXPO_PUBLIC_APP_VARIANT === 'device' ? '/device/login' : '/login';
      setTimeout(() => router.replace(loginPath as '/login'), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <MaterialIcons name="lock-reset" size={28} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>
            Choose a new password for your Xo Cherie account.
          </Text>

          <Input
            name="password"
            label="New password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Input
            name="confirmPassword"
            label="Confirm password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? (
            <Text style={styles.success}>Password updated. Redirecting to sign in…</Text>
          ) : null}

          <Button
            title="Update Password"
            onPress={handleSubmit}
            loading={loading}
            disabled={success}
            size="large"
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.cream },
  content: {
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.dark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  error: {
    fontSize: 13,
    color: theme.colors.error,
    fontWeight: '500',
  },
  success: {
    fontSize: 13,
    color: theme.colors.success,
    fontWeight: '600',
  },
});
