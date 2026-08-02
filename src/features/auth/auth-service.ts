import { getSupabaseClient } from '@/features/auth/supabase-client';

export const AUTH_CALLBACK_URL = 'titanlog://auth/callback';
export const PASSWORD_RESET_CALLBACK_URL = 'titanlog://auth/reset-password';

export class AccountError extends Error {
  constructor(
    readonly code: 'not_configured' | 'not_authenticated' | 'remote_failure'
  ) {
    super(code);
  }
}

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new AccountError('not_configured');
  return client;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await requireClient().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new AccountError('remote_failure');
}

export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<'signed_in' | 'verification_required'> {
  const { data, error } = await requireClient().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { display_name: name.trim() },
      emailRedirectTo: AUTH_CALLBACK_URL,
    },
  });
  if (error) throw new AccountError('remote_failure');
  return data.session ? 'signed_in' : 'verification_required';
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await requireClient().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: PASSWORD_RESET_CALLBACK_URL }
  );
  if (error) throw new AccountError('remote_failure');
}

async function establishSessionFromCallback(
  callbackUrl: string,
  expectedPath: '/callback' | '/reset-password'
): Promise<void> {
  const client = requireClient();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(callbackUrl);
  } catch {
    throw new AccountError('remote_failure');
  }
  if (
    parsedUrl.protocol !== 'titanlog:' ||
    parsedUrl.hostname !== 'auth' ||
    parsedUrl.pathname !== expectedPath
  ) {
    throw new AccountError('remote_failure');
  }
  const query = new URLSearchParams(parsedUrl.search);
  const fragment = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  if (query.has('error') || fragment.has('error')) {
    throw new AccountError('remote_failure');
  }
  const code = query.get('code');
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new AccountError('remote_failure');
  } else {
    const accessToken =
      query.get('access_token') ?? fragment.get('access_token');
    const refreshToken =
      query.get('refresh_token') ?? fragment.get('refresh_token');
    if (!accessToken || !refreshToken) throw new AccountError('remote_failure');
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw new AccountError('remote_failure');
  }
}

export async function completeAuthCallback(callbackUrl: string): Promise<void> {
  await establishSessionFromCallback(callbackUrl, '/callback');
}

export async function preparePasswordResetCallback(
  callbackUrl: string
): Promise<void> {
  await establishSessionFromCallback(callbackUrl, '/reset-password');
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw new AccountError('remote_failure');
}

export async function signOut(): Promise<void> {
  const { error } = await requireClient().auth.signOut({ scope: 'local' });
  if (error) throw new AccountError('remote_failure');
}

export async function requestAccountDeletion(): Promise<void> {
  const client = requireClient();
  const { data } = await client.auth.getUser();
  if (!data.user) throw new AccountError('not_authenticated');
  const { error } = await client.functions.invoke('delete-account', {
    body: { confirmation: 'DELETE_MY_ACCOUNT' },
  });
  if (error) throw new AccountError('remote_failure');
  await client.auth.signOut({ scope: 'local' });
}
