import { MfaVerify } from '@/components/auth/MfaVerify';

export default function DeviceMfaVerifyScreen() {
  return (
    <MfaVerify
      title="Device verification"
      subtitle="Enter the 6-digit authenticator code to open this device."
      defaultNext="/device/inbox"
      cancelTo="/device/login"
    />
  );
}
