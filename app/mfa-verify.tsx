import { MfaVerify } from '@/components/auth/MfaVerify';

export default function MfaVerifyScreen() {
  return (
    <MfaVerify
      defaultNext="/(tabs)"
      cancelTo="/login"
    />
  );
}
