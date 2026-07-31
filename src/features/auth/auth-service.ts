import { getSupabaseClient } from '@/features/auth/supabase-client';

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
    options: { data: { display_name: name.trim() } },
  });
  if (error) throw new AccountError('remote_failure');
  return data.session ? 'signed_in' : 'verification_required';
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await requireClient().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: 'titanlog://auth/reset-password' }
  );
  if (error) throw new AccountError('remote_failure');
}

export async function completePasswordReset(
  callbackUrl: string,
  password: string
): Promise<void> {
  const client = requireClient();
  const parsedUrl = new URL(callbackUrl);
  const query = new URLSearchParams(parsedUrl.search);
  const fragment = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
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
  const { error } = await client.auth.updateUser({ password });
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
