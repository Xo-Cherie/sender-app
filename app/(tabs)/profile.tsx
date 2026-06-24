import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import type { MfaEnrollment } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { invokeEdgeFunction, getEdgeFunctionErrorMessage } from '@/lib/edgeFunctions';
import { Button } from '@/components/ui/Button';

type PrivacySettings = {
  showEmail: boolean;
  allowFriendRequests: boolean;
  shareBirthday: boolean;
};

const DEFAULT_PRIVACY: PrivacySettings = {
  showEmail: false,
  allowFriendRequests: true,
  shareBirthday: false,
};

export default function ProfileScreen() {
  const { user, signOut, refreshUser, getMfaStatus, enrollMfa, verifyMfaEnrollment, disableMfa } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordResetMode, setPasswordResetMode] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | undefined>();
  const [mfaSetup, setMfaSetup] = useState<MfaEnrollment | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setDisplayName(user.displayName || user.name || '');
    setEmail(user.email || '');
    setPhoneNumber(user.phoneNumber || '');
    setBirthday(user.birthday || '');
    setGender(user.gender || '');
    setLocation(user.location || '');
    setAvatarUrl(user.avatar);
    setPrivacy({
      ...DEFAULT_PRIVACY,
      ...(user.privacySettings || {}),
    });
  }, [user]);

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      if (!user) return;
      setMfaLoading(true);
      const status = await getMfaStatus();
      if (mounted) {
        setMfaEnabled(status.enabled);
        setMfaFactorId(status.factorId);
        setMfaLoading(false);
      }
    }

    loadStatus();

    return () => {
      mounted = false;
    };
  }, [getMfaStatus, user]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleDeleteAccount = () => {
    const confirmDelete = async () => {
      setDeletingAccount(true);
      try {
        const { error } = await invokeEdgeFunction('delete-account');
        if (error) {
          const message = await getEdgeFunctionErrorMessage(error, 'Could not delete account');
          showMessage('Delete failed', message);
          return;
        }

        await signOut();
        router.replace('/login');
        showMessage('Account deleted', 'Your account and profile data have been removed.');
      } catch (error: any) {
        showMessage('Delete failed', error?.message || 'Could not delete account');
      } finally {
        setDeletingAccount(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete your account permanently? This cannot be undone.')) {
        confirmDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, profile, and saved preferences. Cards you already sent may remain with recipients. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]
    );
  };

  if (!user) return null;

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets.length) return;

    try {
      setAvatarUploading(true);
      const asset = result.assets[0];
      const publicUrl = await uploadAvatar(asset.uri, asset.mimeType);
      setAvatarUrl(publicUrl);

      const { error: metadataError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (metadataError) throw metadataError;

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert(
          {
            id: user.id,
            email: user.email,
            avatar_url: publicUrl,
          },
          { onConflict: 'id' }
        );
      if (profileError) {
        if (isMissingColumnError(profileError, 'avatar_url')) {
          console.warn('user_profiles.avatar_url is missing; avatar was saved to auth metadata.');
        } else {
          throw profileError;
        }
      }

      await refreshUser();
    } catch (error: any) {
      showMessage('Avatar Upload Failed', error?.message || 'Could not upload profile photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setMfaLoading(true);
    setMfaCode('');
    const { data, error } = await enrollMfa();
    setMfaLoading(false);

    if (error || !data) {
      showMessage('2FA Setup Failed', error || 'Could not start two-factor setup.');
      return;
    }

    setMfaSetup(data);
  };

  const handleVerifyMfaSetup = async () => {
    if (!mfaSetup) return;
    if (mfaCode.trim().length !== 6) {
      showMessage('Invalid Code', 'Enter the 6-digit code from your authenticator app.');
      return;
    }

    setMfaLoading(true);
    const { error } = await verifyMfaEnrollment(mfaSetup.factorId, mfaCode.trim());
    setMfaLoading(false);

    if (error) {
      showMessage('Verification Failed', error);
      return;
    }

    setMfaEnabled(true);
    setMfaFactorId(mfaSetup.factorId);
    setMfaSetup(null);
    setMfaCode('');
    showMessage('2FA Enabled', 'Two-factor authentication is now enabled for this account.');
  };

  const handleDisableMfa = async () => {
    setMfaLoading(true);
    const { error } = await disableMfa(mfaFactorId);
    setMfaLoading(false);

    if (error) {
      showMessage('Could Not Disable 2FA', error);
      return;
    }

    setMfaEnabled(false);
    setMfaFactorId(undefined);
    setMfaSetup(null);
    setMfaCode('');
    showMessage('2FA Disabled', 'Two-factor authentication has been disabled.');
  };

  const handleStartPasswordReset = () => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordResetMode(true);
  };

  const handleCancelPasswordReset = () => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordResetMode(false);
  };

  const handleSave = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!firstName.trim() || !lastName.trim() || !displayName.trim() || !trimmedEmail) {
      showMessage('Missing Information', 'First name, last name, display name, and email are required.');
      return;
    }

    if (passwordResetMode && (newPassword || confirmPassword)) {
      if (newPassword.length < 6) {
        showMessage('Password Too Short', 'New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        showMessage('Password Mismatch', 'New password and confirmation do not match.');
        return;
      }
    }

    setSaving(true);
    try {
      const authData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: displayName.trim(),
        full_name: displayName.trim(),
        phone_number: phoneNumber.trim(),
        birthday: birthday.trim(),
        gender: gender.trim(),
        location: location.trim(),
        avatar_url: avatarUrl,
        privacy_settings: privacy,
      };

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert(
          {
            id: user.id,
            email: trimmedEmail,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone_number: phoneNumber.trim() || null,
            avatar_url: avatarUrl,
          },
          { onConflict: 'id' }
        );
      if (profileError) {
        if (isMissingColumnError(profileError, 'avatar_url')) {
          const { error: retryError } = await supabase
            .from('user_profiles')
            .upsert(
              {
                id: user.id,
                email: trimmedEmail,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone_number: phoneNumber.trim() || null,
              },
              { onConflict: 'id' }
            );
          if (retryError) throw retryError;
          console.warn('user_profiles.avatar_url is missing; profile avatar was saved to auth metadata.');
        } else {
          throw profileError;
        }
      }

      const { error: metadataError } = await supabase.auth.updateUser({ data: authData });
      if (metadataError) throw metadataError;

      if (trimmedEmail !== user.email.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (emailError) throw emailError;
      }

      if (passwordResetMode && newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
        if (passwordError) throw passwordError;
        setNewPassword('');
        setConfirmPassword('');
        setPasswordResetMode(false);
      }

      await refreshUser();
      showMessage(
        'Profile Updated',
        trimmedEmail !== user.email.toLowerCase()
          ? 'Profile saved. Please check your inbox to confirm the email address change.'
          : 'Your profile settings have been saved.'
      );
    } catch (error: any) {
      showMessage('Save Failed', error?.message || 'Could not save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <MaterialIcons name="person" size={48} color={theme.colors.primary} />
            </View>
          )}
          <Pressable style={styles.avatarButton} onPress={pickAvatar} disabled={avatarUploading}>
            {avatarUploading ? (
              <ActivityIndicator color={theme.colors.primary} size="small" />
            ) : (
              <>
                <MaterialIcons name="photo-camera" size={16} color={theme.colors.primary} />
                <Text style={styles.avatarButtonText}>Edit Photo</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.name}>{displayName || user.name}</Text>
          <Text style={styles.email}>{email || user.email}</Text>
        </View>

        <View style={styles.formSection}>
          <SectionTitle icon="person-outline" title="Basic Information" />
          <Field label="First Name" value={firstName} onChangeText={setFirstName} />
          <Field label="Last Name" value={lastName} onChangeText={setLastName} />
          <Field label="Display Name" value={displayName} onChangeText={setDisplayName} />
          <Field label="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone Number (optional)" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
        </View>

        <View style={styles.formSection}>
          <SectionTitle icon="cake" title="Personal Information" />
          <Field label="Birthday" value={birthday} onChangeText={setBirthday} placeholder="YYYY-MM-DD" />
          <Field label="Gender (optional)" value={gender} onChangeText={setGender} />
          <Field label="Location (optional)" value={location} onChangeText={setLocation} />
        </View>

        <View style={styles.formSection}>
          <SectionTitle icon="settings" title="Account Settings" />
          <View style={styles.passwordBox}>
            <View style={styles.passwordHeader}>
              <View style={styles.passwordTextWrap}>
                <Text style={styles.passwordTitle}>Password</Text>
                <Text style={styles.passwordDescription}>
                  {passwordResetMode
                    ? 'Enter a new password, then tap Save Changes.'
                    : 'Password fields are locked until you choose to reset your password.'}
                </Text>
              </View>
              <Button
                title={passwordResetMode ? 'Cancel' : 'Reset Password'}
                onPress={passwordResetMode ? handleCancelPasswordReset : handleStartPasswordReset}
                variant={passwordResetMode ? 'ghost' : 'outline'}
                size="small"
              />
            </View>
            <Field
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              editable={passwordResetMode}
              placeholder={passwordResetMode ? 'Enter new password' : 'Tap Reset Password to edit'}
            />
            <Field
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={passwordResetMode}
              placeholder={passwordResetMode ? 'Confirm new password' : 'Tap Reset Password to edit'}
            />
          </View>
          <View style={styles.mfaBox}>
            <View style={styles.mfaHeader}>
              <View>
                <Text style={styles.mfaTitle}>Two-Factor Authentication</Text>
                <Text style={styles.mfaDescription}>
                  Require a 6-digit authenticator code after signing in.
                </Text>
              </View>
              <View style={[styles.mfaStatusBadge, mfaEnabled && styles.mfaStatusBadgeEnabled]}>
                <Text style={[styles.mfaStatusText, mfaEnabled && styles.mfaStatusTextEnabled]}>
                  {mfaEnabled ? 'Enabled' : 'Off'}
                </Text>
              </View>
            </View>

            {mfaLoading && !mfaSetup ? (
              <View style={styles.mfaLoadingRow}>
                <ActivityIndicator color={theme.colors.primary} size="small" />
                <Text style={styles.mfaDescription}>Checking two-factor status...</Text>
              </View>
            ) : mfaSetup ? (
              <View style={styles.mfaSetup}>
                {mfaSetup.uri ? (
                  <View style={styles.qrWrap}>
                    <QRCode value={mfaSetup.uri} size={180} />
                  </View>
                ) : null}
                <Text style={styles.mfaDescription}>
                  Scan this QR code in an authenticator app, then enter the 6-digit code.
                </Text>
                {mfaSetup.secret ? (
                  <Text selectable style={styles.mfaSecret}>Manual key: {mfaSetup.secret}</Text>
                ) : null}
                <Field
                  label="Authenticator Code"
                  value={mfaCode}
                  onChangeText={setMfaCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="123456"
                  style={styles.mfaCodeInput}
                />
                <View style={styles.mfaActions}>
                  <Button title="Verify & Enable" onPress={handleVerifyMfaSetup} loading={mfaLoading} style={styles.mfaActionButton} />
                  <Button title="Cancel" onPress={() => { setMfaSetup(null); setMfaCode(''); }} variant="ghost" style={styles.mfaActionButton} />
                </View>
              </View>
            ) : mfaEnabled ? (
              <Button title="Disable Two-Factor Authentication" onPress={handleDisableMfa} variant="outline" loading={mfaLoading} />
            ) : (
              <Button title="Set Up Two-Factor Authentication" onPress={handleStartMfaSetup} loading={mfaLoading} />
            )}
          </View>
        </View>

        <View style={styles.formSection}>
          <SectionTitle icon="payments" title="Monetary Gifts" />
          <Text style={styles.giftSectionDescription}>
            Send gifts with cards using Stripe. Set up payouts to receive monetary gifts from friends.
          </Text>
          <Button
            title="Gift Transaction History"
            onPress={() => router.push('/gift-history')}
            variant="outline"
            style={styles.giftSectionButton}
          />
          <Button
            title="Set Up Gift Payouts"
            onPress={() => router.push('/gift-payout-setup')}
            variant="outline"
            style={styles.giftSectionButton}
          />
        </View>

        <View style={styles.formSection}>
          <SectionTitle icon="lock-outline" title="Privacy Settings" />
          <ToggleRow
            label="Show Email to Friends"
            value={privacy.showEmail}
            onValueChange={(value) => setPrivacy(prev => ({ ...prev, showEmail: value }))}
          />
          <ToggleRow
            label="Allow Friend Requests"
            value={privacy.allowFriendRequests}
            onValueChange={(value) => setPrivacy(prev => ({ ...prev, allowFriendRequests: value }))}
          />
          <ToggleRow
            label="Share Birthday Reminders"
            value={privacy.shareBirthday}
            onValueChange={(value) => setPrivacy(prev => ({ ...prev, shareBirthday: value }))}
          />
        </View>

        <View style={styles.saveSection}>
          <Button title={saving ? 'Saving...' : 'Save Changes'} onPress={handleSave} loading={saving} />
        </View>

        <View style={styles.logoutSection}>
          <Button
            title="Log Out"
            onPress={handleLogout}
            variant="outline"
            style={styles.logoutButton}
          />
          <Button
            title={deletingAccount ? 'Deleting...' : 'Delete Account'}
            onPress={handleDeleteAccount}
            variant="outline"
            disabled={deletingAccount}
            style={styles.deleteAccountButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ icon, title }: { icon: keyof typeof MaterialIcons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <MaterialIcons name={icon} size={20} color={theme.colors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
};

function Field({ label, style, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, props.editable === false && styles.inputDisabled, style]}
        placeholderTextColor={theme.colors.mediumGray}
      />
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.lightGray, true: theme.colors.primaryLight }}
        thumbColor={value ? theme.colors.primary : theme.colors.white}
      />
    </View>
  );
}

async function uploadAvatar(uri: string, mimeType?: string | null): Promise<string> {
  const ext = getAvatarExtension(uri, mimeType);
  const fileName = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const contentType = mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg');
  let arrayBuffer: ArrayBuffer;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read selected photo.');
    arrayBuffer = await response.arrayBuffer();
  } else {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    } as any);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    arrayBuffer = bytes.buffer;
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error('You must be signed in to upload a profile photo.');

  const path = `${userId}/${fileName}`;
  const { error } = await supabase.storage
    .from('card-media')
    .upload(path, arrayBuffer, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('card-media').getPublicUrl(path);
  return data.publicUrl;
}

function getAvatarExtension(uri: string, mimeType?: string | null) {
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('webp')) return 'webp';
  const ext = uri.split('.').pop()?.toLowerCase().split('?')[0];
  return ext && /^[a-z0-9]+$/.test(ext) && ext.length <= 5 ? ext : 'jpg';
}

function isMissingColumnError(error: any, column: string) {
  const message = typeof error?.message === 'string' ? error.message : '';
  return message.includes(`'${column}' column`) || (error?.code === 'PGRST204' && message.includes(`'${column}'`));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing.xl,
  },
  header: {
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
  },
  profileCard: {
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.lg,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.card,
    marginBottom: theme.spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: theme.spacing.md,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
  },
  email: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  avatarButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  formSection: {
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.dark,
    fontFamily: theme.fonts.serif,
  },
  giftSectionDescription: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  giftSectionButton: {
    marginBottom: theme.spacing.sm,
  },
  field: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.charcoal,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.cream,
    borderWidth: 1,
    borderColor: theme.colors.borderGray,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.dark,
  },
  inputDisabled: {
    opacity: 0.6,
    color: theme.colors.mediumGray,
  },
  passwordBox: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
    paddingTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  passwordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  passwordTextWrap: {
    flex: 1,
  },
  passwordTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.dark,
  },
  passwordDescription: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    lineHeight: 17,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.dark,
  },
  toggleDescription: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    lineHeight: 17,
    marginTop: 2,
  },
  mfaBox: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
    paddingTop: theme.spacing.md,
  },
  mfaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  mfaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.dark,
  },
  mfaDescription: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    lineHeight: 17,
    marginTop: 4,
  },
  mfaStatusBadge: {
    backgroundColor: theme.colors.creamDark,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  mfaStatusBadgeEnabled: {
    backgroundColor: '#F0FFF4',
  },
  mfaStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.mediumGray,
  },
  mfaStatusTextEnabled: {
    color: theme.colors.success,
  },
  mfaLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  mfaSetup: {
    gap: theme.spacing.md,
  },
  qrWrap: {
    alignSelf: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
  },
  mfaSecret: {
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    fontSize: 12,
    color: theme.colors.charcoal,
  },
  mfaCodeInput: {
    textAlign: 'center',
    letterSpacing: 6,
    fontSize: 20,
    fontWeight: '700',
  },
  mfaActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  mfaActionButton: {
    flex: 1,
  },
  saveSection: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  section: {
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.dark,
    marginLeft: theme.spacing.md,
  },
  logoutSection: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  logoutButton: {},
  deleteAccountButton: {
    borderColor: theme.colors.error,
  },
});
