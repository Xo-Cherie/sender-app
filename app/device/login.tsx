import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

type DeviceAuthMode = 'signIn' | 'signUp' | 'verify' | 'forgotPassword';

export default function DeviceLogin() {
  const router = useRouter();
  const { signIn, signUp, verifyOtp, requestPasswordReset } = useAuth();

  const [mode, setMode] = useState<DeviceAuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) { setError('Email and password are required'); return; }
    setLoading(true); setError('');
    const { error: err, mfaRequired } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) { setError(err); return; }
    if (mfaRequired) {
      router.replace({ pathname: '/device/mfa-verify', params: { next: '/device/inbox' } });
      return;
    }
    router.replace('/device/inbox');
  };

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) { setError('All fields are required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    const { error: err } = await signUp(email.trim(), password, name.trim());
    setLoading(false);
    if (err) { setError(err); return; }
    setMode('verify');
  };

  const handleVerify = async () => {
    if (!otp.trim()) { setError('Enter the verification code'); return; }
    setLoading(true); setError('');
    const { error: err } = await verifyOtp(email.trim(), otp.trim());
    setLoading(false);
    if (err) { setError(err); return; }
    router.replace('/device/inbox');
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email address first'); return; }
    setLoading(true); setError(''); setResetSent(false);
    const { error: err } = await requestPasswordReset(email.trim());
    setLoading(false);
    if (err) { setError(err); return; }
    setResetSent(true);
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Logo / Branding */}
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="tablet-mac" size={40} color={theme.colors.white} />
          </View>
          <Text style={styles.logoTitle}>Cherie Device</Text>
          <Text style={styles.logoSub}>Your personal card-receiving display</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {mode === 'verify' ? (
            <>
              <Text style={styles.cardTitle}>Check your email</Text>
              <Text style={styles.cardDesc}>We sent a verification code to {email}</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={styles.input}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="Enter 8-digit code"
                  keyboardType="number-pad"
                  autoFocus
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable style={styles.btn} onPress={handleVerify} disabled={loading}>
                {loading ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.btnText}>Verify &amp; Open Device</Text>}
              </Pressable>
            </>
          ) : mode === 'forgotPassword' ? (
            <>
              <Text style={styles.cardTitle}>Reset your password</Text>
              <Text style={styles.cardDesc}>Enter your account email and we&apos;ll send a reset link.</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {resetSent ? <Text style={styles.success}>Reset link sent! Check your email.</Text> : null}
              <Pressable style={styles.btn} onPress={handleForgotPassword} disabled={loading}>
                {loading ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.btnText}>Send Reset Link</Text>}
              </Pressable>
              <Pressable onPress={() => { setMode('signIn'); setError(''); setResetSent(false); }} style={styles.forgotBack}>
                <Text style={styles.forgotBackText}>Back to Sign In</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Mode tabs */}
              <View style={styles.tabs}>
                <Pressable style={[styles.tab, mode === 'signIn' && styles.tabActive]} onPress={() => { setMode('signIn'); setError(''); }}>
                  <Text style={[styles.tabText, mode === 'signIn' && styles.tabTextActive]}>Sign In</Text>
                </Pressable>
                <Pressable style={[styles.tab, mode === 'signUp' && styles.tabActive]} onPress={() => { setMode('signUp'); setError(''); }}>
                  <Text style={[styles.tabText, mode === 'signUp' && styles.tabTextActive]}>Create Account</Text>
                </Pressable>
              </View>

              {mode === 'signUp' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                />
              </View>

              {mode === 'signIn' ? (
                <Pressable onPress={() => { setMode('forgotPassword'); setError(''); setResetSent(false); }} style={styles.forgotLinkWrap}>
                  <Text style={styles.forgotLink}>Forgot Password?</Text>
                </Pressable>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                style={styles.btn}
                onPress={mode === 'signIn' ? handleSignIn : handleSignUp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={theme.colors.white} />
                  : <Text style={styles.btnText}>{mode === 'signIn' ? 'Sign In to Device' : 'Create Account'}</Text>
                }
              </Pressable>
            </>
          )}
        </View>

        <Text style={styles.hint}>
          Use the same account you use on the Xo Cherie mobile app.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
  },
  brand: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
    letterSpacing: -0.5,
  },
  logoSub: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    marginTop: 6,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: 32,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.dark,
    marginBottom: 8,
    fontFamily: theme.fonts.serif,
  },
  cardDesc: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    marginBottom: 24,
    lineHeight: 20,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.creamDark,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: 24,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.mediumGray,
  },
  tabTextActive: {
    color: theme.colors.white,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.charcoal,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.cream,
    borderWidth: 1.5,
    borderColor: theme.colors.borderGray,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.dark,
    outlineStyle: 'none',
  } as any,
  error: {
    fontSize: 13,
    color: theme.colors.error,
    marginBottom: 12,
    backgroundColor: theme.colors.errorLight,
    padding: 10,
    borderRadius: theme.borderRadius.sm,
  },
  success: {
    fontSize: 13,
    color: theme.colors.success,
    marginBottom: 12,
    fontWeight: '600',
  },
  forgotLinkWrap: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotLink: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  forgotBack: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotBackText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  btn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  btnText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginTop: 24,
    maxWidth: 320,
    lineHeight: 20,
  },
});
