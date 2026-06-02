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
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
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
  const { user, signOut, refreshUser } = useAuth();
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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY);

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
    setTwoFactorEnabled(!!user.twoFactorEnabled);
    setPrivacy({
      ...DEFAULT_PRIVACY,
      ...(user.privacySettings || {}),
    });
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
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
    } catch (error: any) {
      showMessage('Avatar Upload Failed', error?.message || 'Could not upload profile photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!firstName.trim() || !lastName.trim() || !displayName.trim() || !trimmedEmail) {
      showMessage('Missing Information', 'First name, last name, display name, and email are required.');
      return;
    }

    if (newPassword || confirmPassword) {
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
        two_factor_enabled: twoFactorEnabled,
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
          },
          { onConflict: 'id' }
        );
      if (profileError) throw profileError;

      const { error: metadataError } = await supabase.auth.updateUser({ data: authData });
      if (metadataError) throw metadataError;

      if (trimmedEmail !== user.email.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (emailError) throw emailError;
      }

      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
        if (passwordError) throw passwordError;
        setNewPassword('');
        setConfirmPassword('');
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
          <Field label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Leave blank to keep current password" />
          <Field label="Confirm New Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          <ToggleRow
            label="Two-Factor Authentication"
            description="Save your preference for added account security."
            value={twoFactorEnabled}
            onValueChange={setTwoFactorEnabled}
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
        </View>

        <View style={styles.mockBadge}>
          <MaterialIcons name="info-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.mockText}>V1.0 Demo Mode</Text>
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
        style={[styles.input, style]}
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
  mockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.sm,
  },
  mockText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  logoutSection: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  logoutButton: {
    borderColor: theme.colors.error,
  },
});
