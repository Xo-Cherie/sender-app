import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';

type InvokeOptions = {
  body?: Record<string, any>;
};

type InvokeResult<T> = {
  data: T | null;
  error: any | null;
};

const functionsUrlOverride = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL?.replace(/\/$/, '');

function createFunctionError(message: string, response?: Response) {
  const error = new Error(message) as Error & { context?: Response };
  if (response) {
    error.context = response;
  }
  return error;
}

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  if (!functionsUrlOverride) {
    return supabase.functions.invoke<T>(functionName, options);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return {
      data: null,
      error: createFunctionError('You must be signed in to use this feature'),
    };
  }

  try {
    const response = await fetch(`${functionsUrlOverride}/${functionName}`, {
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
      const message = typeof data === 'object' && data && 'error' in data
        ? String((data as { error?: unknown }).error)
        : `Edge Function returned ${response.status}`;

      return {
        data,
        error: createFunctionError(message, response),
      };
    }

    return { data, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: createFunctionError(error.message || 'Could not reach Edge Function'),
    };
  }
}

export function getDefaultFunctionsUrl() {
  return `${supabaseUrl}/functions/v1`;
}
