import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type AuthScreen = 'signIn' | 'signUp' | 'verify';
type AuthSearchParams = {
  screen?: string | string[];
  mode?: string | string[];
  email?: string | string[];
};
const VERIFICATION_CODE_LENGTH = 8;

function getFirstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getRequestedScreen(params: AuthSearchParams): AuthScreen {
  const requestedScreen = (getFirstParam(params.screen) || getFirstParam(params.mode) || '').toLowerCase();
  return ['signup', 'sign-up', 'sign_up'].includes(requestedScreen) ? 'signUp' : 'signIn';
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<AuthSearchParams>();
  const { signIn, signUp, verifyOtp, resendOtp } = useAuth();
  const requestedScreen = getRequestedScreen(params);
  const requestedEmail = getFirstParam(params.email) || '';

  const [screen, setScreen] = useState<AuthScreen>(requestedScreen);
  const [email, setEmail] = useState(requestedEmail);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (requestedScreen === 'signUp') {
      setScreen('signUp');
    }

    if (requestedEmail) {
      setEmail(requestedEmail);
    }
  }, [requestedScreen, requestedEmail]);

  const handleSignIn = async () => {
    setError('');
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const { error: authError } = await signIn(email, password);
      if (authError) setError(authError);
      else router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError('');
    if (!email || !password || !name) { setError('Please fill in all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const { error: authError } = await signUp(email, password, name);
      if (authError) setError(authError);
      else setScreen('verify');
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    if (!verificationCode || verificationCode.length !== VERIFICATION_CODE_LENGTH) {
      setError(`Please enter the ${VERIFICATION_CODE_LENGTH}-digit code`);
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await verifyOtp(email, verificationCode);
      if (verifyError) setError(verifyError);
      else router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResendLoading(true);
    try {
      const { error: resendError } = await resendOtp(email);
      if (resendError) setError(resendError);
      else setError('Code sent!');
    } catch (err: any) {
      setError(err.message || 'Resend failed');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Area */}
          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoScript}>Xo</Text>
            </View>
            <Text style={styles.brandName}>Xo Cherie</Text>
            <Text style={styles.tagline}>Send cards that last forever</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {screen === 'verify' ? (
              <>
                <View style={styles.verifyHeader}>
                  <View style={styles.verifyIconWrap}>
                    <MaterialIcons name="mark-email-read" size={28} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.cardTitle}>Check your email</Text>
                  <Text style={styles.cardSubtitle}>
                    We sent an {VERIFICATION_CODE_LENGTH}-digit code to{'\n'}
                    <Text style={{ color: theme.colors.dark, fontWeight: '600' }}>{email}</Text>
                  </Text>
                </View>

                <Input
                  name="otp"
                  label="Verification Code"
                  placeholder={'0'.repeat(VERIFICATION_CODE_LENGTH)}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={VERIFICATION_CODE_LENGTH}
                  style={styles.otpInput}
                />

                {error ? <ErrorBlock message={error} /> : null}

                <Button title="Verify Email" onPress={handleVerify} loading={loading} size="large" style={{ marginTop: 4 }} />

                <View style={styles.linkRow}>
                  <Pressable onPress={handleResend} disabled={resendLoading}>
                    <Text style={styles.link}>{resendLoading ? 'Sending...' : 'Resend code'}</Text>
                  </Pressable>
                  <Text style={styles.dot}>·</Text>
                  <Pressable onPress={() => { setScreen('signUp'); setError(''); setVerificationCode(''); }}>
                    <Text style={styles.link}>Change email</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>
                  {screen === 'signUp' ? 'Create account' : 'Welcome back'}
                </Text>

                {screen === 'signUp' && (
                  <Input name="name" label="Name" placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
                )}
                <Input name="email" label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <Input name="password" label="Password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />

                {error ? <ErrorBlock message={error} /> : null}

                <Button
                  title={screen === 'signUp' ? 'Create Account' : 'Sign In'}
                  onPress={screen === 'signUp' ? handleSignUp : handleSignIn}
                  loading={loading}
                  size="large"
                  style={{ marginTop: 4 }}
                />

                <Pressable
                  onPress={() => { setScreen(screen === 'signUp' ? 'signIn' : 'signUp'); setError(''); }}
                  style={styles.switchRow}
                >
                  <Text style={styles.switchText}>
                    {screen === 'signUp' ? 'Already have an account? ' : "Don't have an account? "}
                    <Text style={styles.switchLink}>
                      {screen === 'signUp' ? 'Sign In' : 'Sign Up'}
                    </Text>
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ErrorBlock({ message }: { message: string }) {
  const isSuccess = message.includes('sent') || message.includes('Code');
  return (
    <View style={[errorStyles.container, isSuccess && errorStyles.successContainer]}>
      <MaterialIcons
        name={isSuccess ? 'check-circle' : 'error-outline'}
        size={16}
        color={isSuccess ? theme.colors.success : theme.colors.error}
      />
      <Text style={[errorStyles.text, isSuccess && errorStyles.successText]}>{message}</Text>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.errorLight,
    padding: 12,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
  },
  successContainer: {
    backgroundColor: '#F0FFF4',
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.error,
    fontWeight: '500',
  },
  successText: {
    color: theme.colors.success,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    paddingTop: theme.spacing.xl,
  },
  logoArea: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.elevated,
  },
  logoScript: {
    fontSize: 28,
    color: theme.colors.white,
    fontFamily: theme.fonts.script,
    fontWeight: '700',
  },
  brandName: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: theme.colors.mediumGray,
    marginTop: 6,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.card,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.dark,
    marginBottom: theme.spacing.lg,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  verifyHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  verifyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '700',
  },
  switchRow: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  switchText: {
    fontSize: 14,
    color: theme.colors.mediumGray,
  },
  switchLink: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.lg,
  },
  link: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  dot: {
    color: theme.colors.mediumGray,
    fontSize: 16,
  },
});
