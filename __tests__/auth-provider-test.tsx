import type { Session } from '@supabase/supabase-js';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockStartAutoRefresh = jest.fn();
const mockStopAutoRefresh = jest.fn();
const mockUnsubscribe = jest.fn();
let authStateListener:
  ((event: string, session: Session | null) => void) | null;

jest.mock('@/features/auth/supabase-client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      startAutoRefresh: mockStartAutoRefresh,
      stopAutoRefresh: mockStopAutoRefresh,
    },
  }),
  isSupabaseConfigured: () => true,
}));

import { AuthProvider, useAuth } from '@/features/auth/auth-provider';

function AuthProbe() {
  const { initializing, session } = useAuth();
  return (
    <Text>{initializing ? 'initializing' : (session?.user.id ?? 'guest')}</Text>
  );
}

describe('authentication session restoration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStateListener = null;
    mockOnAuthStateChange.mockImplementation((listener) => {
      authStateListener = listener;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });
  });

  it('settles the restored session before callback navigation can continue', async () => {
    const session = {
      user: { id: 'restored-user' },
    } as unknown as Session;
    mockGetSession.mockResolvedValue({ data: { session } });
    const view = await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(view.getByText('restored-user')).toBeTruthy());
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a fresh auth event with a stale restoration result', async () => {
    let resolveRestoration!: (value: {
      data: { session: Session | null };
    }) => void;
    mockGetSession.mockReturnValue(
      new Promise((resolve) => {
        resolveRestoration = resolve;
      })
    );
    const view = await render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );
    const freshSession = {
      user: { id: 'fresh-user' },
    } as unknown as Session;

    await act(async () => {
      authStateListener?.('SIGNED_IN', freshSession);
      resolveRestoration({ data: { session: null } });
    });

    await waitFor(() => expect(view.getByText('fresh-user')).toBeTruthy());
  });
});
