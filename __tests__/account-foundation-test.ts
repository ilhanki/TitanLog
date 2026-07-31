import {
  completeAuthCallback,
  completePasswordReset,
  requestAccountDeletion,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
} from '@/features/auth/auth-service';

const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockSignOut = jest.fn();
const mockGetUser = jest.fn();
const mockInvoke = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockSetSession = jest.fn();
const mockUpdateUser = jest.fn();
let mockConfigured = true;

jest.mock('@/features/auth/supabase-client', () => ({
  getSupabaseClient: () =>
    mockConfigured
      ? {
          auth: {
            getUser: mockGetUser,
            exchangeCodeForSession: mockExchangeCodeForSession,
            resetPasswordForEmail: mockResetPasswordForEmail,
            setSession: mockSetSession,
            signInWithPassword: mockSignInWithPassword,
            signOut: mockSignOut,
            signUp: mockSignUp,
            updateUser: mockUpdateUser,
          },
          functions: { invoke: mockInvoke },
        }
      : null,
}));

describe('optional account foundation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigured = true;
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
      error: null,
    });
    mockInvoke.mockResolvedValue({ error: null });
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockSetSession.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it('normalizes email for sign-in and sign-up without logging credentials', async () => {
    await signIn(' USER@Example.COM ', 'password');
    await expect(
      signUp(' Test User ', ' USER@Example.COM ', 'password')
    ).resolves.toBe('verification_required');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password',
    });
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        options: expect.objectContaining({
          emailRedirectTo: 'titanlog://auth/callback',
        }),
      })
    );
  });

  it('uses the application deep link for password reset', async () => {
    await requestPasswordReset('user@example.com');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'titanlog://auth/reset-password',
    });
  });

  it('exchanges only the password-reset callback code before updating', async () => {
    await completePasswordReset(
      'titanlog://auth/reset-password?code=verified-code',
      'new-password'
    );
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('verified-code');
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-password' });
  });

  it('handles the verified email callback and rejects an unrelated route', async () => {
    await completeAuthCallback('titanlog://auth/callback?code=callback-code');
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('callback-code');
    await expect(
      completeAuthCallback('titanlog://profile?code=callback-code')
    ).rejects.toMatchObject({ code: 'remote_failure' });
  });

  it('clears only the local session on sign-out', async () => {
    await signOut();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('uses the backend-owned account deletion function', async () => {
    await requestAccountDeletion();
    expect(mockInvoke).toHaveBeenCalledWith('delete-account', {
      body: { confirmation: 'DELETE_MY_ACCOUNT' },
    });
  });

  it('reports missing environment configuration truthfully', async () => {
    mockConfigured = false;
    await expect(signIn('user@example.com', 'password')).rejects.toMatchObject({
      code: 'not_configured',
    });
  });
});
