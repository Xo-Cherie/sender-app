import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from '@/lib/supabase';

export type AuthCallbackResult = {
  isRecovery: boolean;
};

/** Exchange Supabase auth tokens/code from an email link or deep link URL. */
export async function establishSessionFromAuthUrl(url: string): Promise<AuthCallbackResult> {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  const authError = params.error_description || params.error;
  if (authError) {
    throw new Error(String(authError));
  }

  let isRecovery = params.type === 'recovery';

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
  } else if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    if (params.type === 'recovery') {
      isRecovery = true;
    }
  }

  return { isRecovery };
}
