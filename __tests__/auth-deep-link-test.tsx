import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AuthCallbackScreen } from '@/features/auth/auth-callback-screen';
import { resetAuthCallbackCoordinatorForTests } from '@/features/auth/auth-callback-coordinator';
import { ResetPasswordScreen } from '@/features/auth/reset-password-screen';

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};
let mockUrl: string | null = null;
let mockRootNavigationState: { key: string } | undefined = { key: 'root' };
let mockAuthState: {
  configured: boolean;
  initializing: boolean;
  session: { user: { id: string } } | null;
  user: { id: string } | null;
} = {
  configured: true,
  initializing: false,
  session: { user: { id: 'safe-test-user' } },
  user: { id: 'safe-test-user' },
};

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(
    async (_algorithm: string, value: string) => `test-digest:${value}`
  ),
}));
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockUrl }));
jest.mock('expo-router', () => ({
  useRootNavigationState: () => mockRootNavigationState,
  useRouter: () => mockRouter,
}));
jest.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => mockAuthState,
}));
jest.mock('@/features/auth/auth-service', () => ({
  completeAuthCallback: jest.fn(),
  preparePasswordResetCallback: jest.fn(),
  updatePassword: jest.fn(),
}));

import * as AuthService from '@/features/auth/auth-service';

const mockCompleteAuthCallback = AuthService.completeAuthCallback as jest.Mock;
const mockPreparePasswordResetCallback =
  AuthService.preparePasswordResetCallback as jest.Mock;
const mockUpdatePassword = AuthService.updatePassword as jest.Mock;

function readyAuthState() {
  return {
    configured: true,
    initializing: false,
    session: { user: { id: 'safe-test-user' } },
    user: { id: 'safe-test-user' },
  };
}

describe('authentication deep links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthCallbackCoordinatorForTests();
    mockUrl = null;
    mockRootNavigationState = { key: 'root' };
    mockAuthState = readyAuthState();
    mockCompleteAuthCallback.mockResolvedValue(undefined);
    mockPreparePasswordResetCallback.mockResolvedValue(undefined);
    mockUpdatePassword.mockResolvedValue(undefined);
  });

  it('waits for root navigation and restored session on a cold verification start', async () => {
    mockUrl = 'titanlog://auth/callback?code=cold-verification';
    mockRootNavigationState = undefined;
    mockAuthState = {
      configured: true,
      initializing: true,
      session: null,
      user: null,
    };
    const view = await render(<AuthCallbackScreen />);

    await waitFor(() =>
      expect(mockCompleteAuthCallback).toHaveBeenCalledWith(mockUrl)
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();

    mockRootNavigationState = { key: 'root' };
    mockAuthState = readyAuthState();
    await view.rerender(<AuthCallbackScreen />);

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile')
    );
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('handles a warm verification URL and uses only a concrete Expo Router href', async () => {
    const view = await render(<AuthCallbackScreen />);
    expect(mockCompleteAuthCallback).not.toHaveBeenCalled();

    mockUrl = 'titanlog://auth/callback?code=warm-verification';
    await view.rerender(<AuthCallbackScreen />);

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    const [destination, nestedParams] = mockRouter.replace.mock.calls[0] ?? [];
    expect(destination).toBe('/(tabs)/profile');
    expect(typeof destination).toBe('string');
    expect(nestedParams).toBeUndefined();
    expect(destination).not.toEqual(
      expect.objectContaining({
        pathname: '/(tabs)',
        params: expect.objectContaining({ screen: 'profile' }),
      })
    );
  });

  it('processes and navigates the same callback only once across remounts', async () => {
    mockUrl = 'titanlog://auth/callback?code=duplicate-verification';
    const first = await render(<AuthCallbackScreen />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    await first.unmount();

    const second = await render(<AuthCallbackScreen />);
    await waitFor(() =>
      expect(
        second.getByText('Bu doğrulama bağlantısı daha önce işlendi.')
      ).toBeTruthy()
    );
    expect(
      second.getByRole('button', { name: 'Profil Ekranına Dön' })
    ).toBeTruthy();
    expect(mockCompleteAuthCallback).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
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
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('replaces callback history without push or back navigation', async () => {
    mockUrl = 'titanlog://auth/callback?code=history-replacement';
    await render(<AuthCallbackScreen />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(JSON.stringify(mockRouter.replace.mock.calls)).not.toMatch(
      /callback|access_token|refresh_token|code=/i
    );
  });

  it('prepares password recovery before input and waits for root readiness after update', async () => {
    mockUrl = 'titanlog://auth/reset-password?code=cold-recovery';
    mockRootNavigationState = undefined;
    const view = await render(<ResetPasswordScreen />);

    await waitFor(() =>
      expect(mockPreparePasswordResetCallback).toHaveBeenCalledWith(mockUrl)
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
      expect(mockUpdatePassword).toHaveBeenCalledWith('new-password')
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();

    mockRootNavigationState = { key: 'root' };
    await view.rerender(<ResetPasswordScreen />);
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile')
    );
  });

  it('handles a warm password reset URL and never routes before update succeeds', async () => {
    let resolveUpdate!: () => void;
    mockUpdatePassword.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      })
    );
    const view = await render(<ResetPasswordScreen />);
    mockUrl = 'titanlog://auth/reset-password?code=warm-recovery';
    await view.rerender(<ResetPasswordScreen />);

    await waitFor(() =>
      expect(mockPreparePasswordResetCallback).toHaveBeenCalledWith(mockUrl)
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
    expect(mockRouter.replace).not.toHaveBeenCalled();

    resolveUpdate();
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile')
    );
  });

  it('does not log or import fitness-data side effects from callback screens', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUrl =
      'titanlog://auth/callback#access_token=sensitive&refresh_token=sensitive';
    await render(<AuthCallbackScreen />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    const callbackSources = [
      'src/features/auth/auth-callback-screen.tsx',
      'src/features/auth/reset-password-screen.tsx',
      'src/features/auth/auth-callback-coordinator.ts',
    ]
      .map((path) => readFileSync(join(process.cwd(), path), 'utf8'))
      .join('\n');
    expect(callbackSources).not.toMatch(
      /data-safety|dataset-ownership|backup|manual-sync|sync-state|SQLite/i
    );
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('keeps concrete callback, recovery, and profile routes in the route tree', () => {
    for (const route of [
      'app/auth/callback.tsx',
      'app/auth/reset-password.tsx',
      'app/(tabs)/profile.tsx',
    ]) {
      expect(() =>
        readFileSync(join(process.cwd(), route), 'utf8')
      ).not.toThrow();
    }
  });
});
