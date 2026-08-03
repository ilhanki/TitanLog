import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AuthCallbackScreen } from '@/features/auth/auth-callback-screen';
import { resetAuthCallbackCoordinatorForTests } from '@/features/auth/auth-callback-coordinator';
import {
  getAuthNavigationStateSnapshot,
  resetAuthNavigationStateForTests,
} from '@/features/auth/auth-navigation-state';
import { PostAuthDestinationConsumer } from '@/features/auth/post-auth-destination-consumer';
import { ResetPasswordScreen } from '@/features/auth/reset-password-screen';

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};
let mockUrl: string | null = null;
let mockDatasetAccess: 'checking' | 'granted' = 'checking';
let mockAuthState: {
  configured: boolean;
  initializing: boolean;
  session: { user: { id: string } } | null;
  user: { id: string } | null;
} = {
  configured: true,
  initializing: true,
  session: null,
  user: null,
};

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(
    async (_algorithm: string, value: string) => `test-digest:${value}`
  ),
}));
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockUrl }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => mockAuthState,
}));
jest.mock('@/features/data-safety/dataset-access-guard', () => ({
  useDatasetAccess: () => ({ state: mockDatasetAccess }),
}));
jest.mock('@/features/auth/auth-service', () => ({
  completeAuthCallback: jest.fn(),
  preparePasswordResetCallback: jest.fn(),
  signOut: jest.fn(),
  updatePassword: jest.fn(),
}));

import * as AuthService from '@/features/auth/auth-service';

const mockCompleteAuthCallback = AuthService.completeAuthCallback as jest.Mock;
const mockPreparePasswordResetCallback =
  AuthService.preparePasswordResetCallback as jest.Mock;
const mockUpdatePassword = AuthService.updatePassword as jest.Mock;

function setAuthenticatedAccessReady() {
  mockAuthState = {
    configured: true,
    initializing: false,
    session: { user: { id: 'safe-test-user' } },
    user: { id: 'safe-test-user' },
  };
  mockDatasetAccess = 'granted';
}

describe('authentication deep links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthCallbackCoordinatorForTests();
    resetAuthNavigationStateForTests();
    mockUrl = null;
    mockDatasetAccess = 'checking';
    mockAuthState = {
      configured: true,
      initializing: true,
      session: null,
      user: null,
    };
    mockCompleteAuthCallback.mockResolvedValue(undefined);
    mockPreparePasswordResetCallback.mockResolvedValue(undefined);
    mockUpdatePassword.mockResolvedValue(undefined);
  });

  it('waits for authenticated route activation on a cold verification start', async () => {
    mockUrl = 'titanlog://auth/callback?code=cold-verification';
    await render(<AuthCallbackScreen />);

    await waitFor(() =>
      expect(mockCompleteAuthCallback).toHaveBeenCalledWith(mockUrl)
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(
      getAuthNavigationStateSnapshot().pendingDestination?.destination
    ).toBe('profile');

    setAuthenticatedAccessReady();
    await render(<PostAuthDestinationConsumer />);

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile')
    );
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('handles a warm verification callback without premature navigation', async () => {
    const view = await render(<AuthCallbackScreen />);
    mockUrl = 'titanlog://auth/callback?code=warm-verification';
    await view.rerender(<AuthCallbackScreen />);

    await waitFor(() => expect(mockCompleteAuthCallback).toHaveBeenCalled());
    expect(mockRouter.replace).not.toHaveBeenCalled();

    setAuthenticatedAccessReady();
    await render(<PostAuthDestinationConsumer />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));

    const [destination, nestedParams] = mockRouter.replace.mock.calls[0] ?? [];
    expect(destination).toBe('/(tabs)/profile');
    expect(nestedParams).toBeUndefined();
    expect(destination).not.toEqual(
      expect.objectContaining({
        pathname: '/(tabs)',
        params: expect.objectContaining({ screen: 'profile' }),
      })
    );
  });

  it('processes a duplicate confirmation link once without a second destination', async () => {
    mockUrl = 'titanlog://auth/callback?code=duplicate-verification';
    const first = await render(<AuthCallbackScreen />);
    await waitFor(() =>
      expect(mockCompleteAuthCallback).toHaveBeenCalledTimes(1)
    );
    await first.unmount();

    const second = await render(<AuthCallbackScreen />);
    await waitFor(() =>
      expect(
        second.getByText('Bu doğrulama bağlantısı daha önce işlendi.')
      ).toBeTruthy()
    );

    expect(mockCompleteAuthCallback).toHaveBeenCalledTimes(1);
    expect(getAuthNavigationStateSnapshot().pendingDestination).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('shows only a safe Turkish error for invalid or expired callbacks', async () => {
    mockUrl = 'titanlog://auth/callback?error=expired';
    mockCompleteAuthCallback.mockRejectedValue(new Error('raw backend error'));
    const { getByText, queryByText } = await render(<AuthCallbackScreen />);

    await waitFor(() =>
      expect(
        getByText('Doğrulama bağlantısı geçersiz veya süresi dolmuş olabilir.')
      ).toBeTruthy()
    );
    expect(queryByText('raw backend error')).toBeNull();
    expect(getAuthNavigationStateSnapshot().pendingDestination).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('replaces only from the active authenticated layout with safe history data', async () => {
    mockUrl = 'titanlog://auth/callback?code=history-replacement';
    await render(<AuthCallbackScreen />);
    await waitFor(() => expect(mockCompleteAuthCallback).toHaveBeenCalled());
    expect(mockRouter.replace).not.toHaveBeenCalled();

    setAuthenticatedAccessReady();
    await render(<PostAuthDestinationConsumer />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));

    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(JSON.stringify(mockRouter.replace.mock.calls)).not.toMatch(
      /callback|access_token|refresh_token|code=/i
    );
  });

  it('keeps recovery distinct and routes only after password update succeeds', async () => {
    mockUrl = 'titanlog://auth/reset-password?code=cold-recovery';
    setAuthenticatedAccessReady();
    const view = await render(<ResetPasswordScreen />);

    await waitFor(() =>
      expect(mockPreparePasswordResetCallback).toHaveBeenCalledWith(mockUrl)
    );
    expect(getAuthNavigationStateSnapshot().flow).toBe('password_recovery');
    await fireEvent.changeText(
      view.getByLabelText('Yeni Şifre'),
      'new-password'
    );
    await fireEvent.changeText(
      view.getByLabelText('Yeni Şifre Tekrarı'),
      'new-password'
    );
    await fireEvent.press(
      view.getByRole('button', { name: 'Şifreyi Güncelle' })
    );

    await waitFor(() =>
      expect(mockUpdatePassword).toHaveBeenCalledWith('new-password')
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(getAuthNavigationStateSnapshot().flow).toBe(
      'password_recovery_complete'
    );
    expect(
      getAuthNavigationStateSnapshot().pendingDestination?.destination
    ).toBe('password_update_complete');

    await render(<PostAuthDestinationConsumer />);
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile')
    );
  });

  it('does not request profile when password update fails', async () => {
    mockUrl = 'titanlog://auth/reset-password?code=failed-recovery';
    setAuthenticatedAccessReady();
    mockUpdatePassword.mockRejectedValue(new Error('remote failure'));
    const view = await render(<ResetPasswordScreen />);

    await waitFor(() =>
      expect(mockPreparePasswordResetCallback).toHaveBeenCalled()
    );
    await fireEvent.changeText(
      view.getByLabelText('Yeni Şifre'),
      'new-password'
    );
    await fireEvent.changeText(
      view.getByLabelText('Yeni Şifre Tekrarı'),
      'new-password'
    );
    await fireEvent.press(
      view.getByRole('button', { name: 'Şifreyi Güncelle' })
    );

    await waitFor(() =>
      expect(
        view.getByText(
          'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş olabilir.'
        )
      ).toBeTruthy()
    );
    expect(getAuthNavigationStateSnapshot().pendingDestination).toBeNull();
    expect(getAuthNavigationStateSnapshot().flow).toBe('password_recovery');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('does not log or import fitness-data side effects from callback flows', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUrl =
      'titanlog://auth/callback#access_token=sensitive&refresh_token=sensitive';
    await render(<AuthCallbackScreen />);
    await waitFor(() => expect(mockCompleteAuthCallback).toHaveBeenCalled());

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    const callbackSources = [
      'src/features/auth/auth-callback-screen.tsx',
      'src/features/auth/reset-password-screen.tsx',
      'src/features/auth/auth-callback-coordinator.ts',
      'src/features/auth/auth-navigation-state.ts',
    ]
      .map((path) => readFileSync(join(process.cwd(), path), 'utf8'))
      .join('\n');
    expect(callbackSources).not.toMatch(
      /dataset-ownership|backup|manual-sync|sync-state|SQLite/i
    );
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('keeps concrete routes and the authenticated consumer in the route tree', () => {
    for (const route of [
      'app/auth/callback.tsx',
      'app/auth/reset-password.tsx',
      'app/(tabs)/profile.tsx',
      'app/(tabs)/_layout.tsx',
    ]) {
      expect(() =>
        readFileSync(join(process.cwd(), route), 'utf8')
      ).not.toThrow();
    }
    const tabsLayout = readFileSync(
      join(process.cwd(), 'app/(tabs)/_layout.tsx'),
      'utf8'
    );
    expect(tabsLayout).toContain('<PostAuthDestinationConsumer />');
  });
});
