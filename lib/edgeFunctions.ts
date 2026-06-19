import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';
import { Platform } from 'react-native';

type InvokeOptions = {
  body?: Record<string, any>;
};

type InvokeResult<T> = {
  data: T | null;
  error: any | null;
};

function getFunctionsBaseUrl() {
  const override = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL?.trim();
  let baseUrl = (override || `${supabaseUrl}/functions/v1`).replace(/\/$/, '');

  if (Platform.OS === 'android') {
    baseUrl = baseUrl.replace(
      /^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/])/,
      (_match, protocol) => `${protocol}10.0.2.2`
    );
  }

  return baseUrl;
}

function createFunctionError(message: string, response?: Response) {
  const error = new Error(message) as Error & { context?: Response };
  if (response) {
    error.context = response;
  }
  return error;
}

export async function getEdgeFunctionErrorMessage(error: any, fallback = 'Request failed'): Promise<string> {
  if (!error) return fallback;

  const response = error.context as Response | undefined;
  if (response && typeof response.clone === 'function') {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === 'string' && body.error.trim()) {
        return body.error;
      }
      if (typeof body?.message === 'string' && body.message.trim()) {
        return body.message;
      }
    } catch {
      try {
        const text = await response.clone().text();
        if (text.trim()) return text;
      } catch {
        // Fall through.
      }
    }
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    if (error.message.includes('non-2xx status code') && error.context) {
      return await getEdgeFunctionErrorMessage({ context: error.context }, fallback);
    }
    return error.message;
  }

  return fallback;
}

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return {
      data: null,
      error: createFunctionError('You must be signed in to use this feature'),
    };
  }

  const baseUrl = getFunctionsBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/${functionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options.body ?? {}),
    });

    const text = await response.text();
    let data: T | null = null;

    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as T;
      }
    }

    if (!response.ok) {
      const message =
        typeof data === 'object' && data && 'error' in data
          ? String((data as { error?: unknown }).error)
          : text?.trim() || `Edge Function returned ${response.status}`;

      return {
        data,
        error: createFunctionError(message, response),
      };
    }

    return { data, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: createFunctionError(
        error?.message ||
          `Could not reach Edge Function at ${baseUrl}/${functionName}. Deploy it with npm run gifts:deploy or check your network.`
      ),
    };
  }
}

export function getDefaultFunctionsUrl() {
  return `${supabaseUrl}/functions/v1`;
}
