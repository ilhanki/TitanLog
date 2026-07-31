import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AuthCallbackScreen } from '@/features/auth/auth-callback-screen';
import { ResetPasswordScreen } from '@/features/auth/reset-password-screen';

const mockRouter = { back: jest.fn(), replace: jest.fn() };
let mockUrl: string | null = null;

jest.mock('expo-linking', () => ({ useLinkingURL: () => mockUrl }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/auth/auth-service', () => ({
  completeAuthCallback: jest.fn(),
  completePasswordReset: jest.fn(),
}));

import * as AuthService from '@/features/auth/auth-service';

const mockCompleteAuthCallback = AuthService.completeAuthCallback as jest.Mock;
const mockCompletePasswordReset =
  AuthService.completePasswordReset as jest.Mock;

describe('authentication deep links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUrl = null;
    mockCompleteAuthCallback.mockResolvedValue(undefined);
    mockCompletePasswordReset.mockResolvedValue(undefined);
  });

  it('handles an email verification callback and replaces callback history', async () => {
    mockUrl = 'titanlog://auth/callback?code=callback-code';
    await render(<AuthCallbackScreen />);
    await waitFor(() =>
      expect(mockCompleteAuthCallback).toHaveBeenCalledWith(mockUrl)
    );
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile')
    );
  });

  it('uses the latest warm-app URL for password reset', async () => {
    mockUrl = 'titanlog://auth/reset-password?code=reset-code';
    const { getByLabelText, getByRole } = await render(<ResetPasswordScreen />);
    await fireEvent.changeText(getByLabelText('Yeni Şifre'), 'new-password');
    await fireEvent.changeText(
      getByLabelText('Yeni Şifre Tekrarı'),
      'new-password'
    );
    await fireEvent.press(getByRole('button', { name: 'Şifreyi Güncelle' }));
    await waitFor(() =>
      expect(mockCompletePasswordReset).toHaveBeenCalledWith(
        mockUrl,
        'new-password'
      )
    );
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile')
    );
  });

  it('shows only a safe Turkish error for an invalid callback', async () => {
    mockUrl = 'titanlog://auth/callback?error=expired';
    mockCompleteAuthCallback.mockRejectedValue(new Error('raw backend error'));
    const { getByText, queryByText } = await render(<AuthCallbackScreen />);
    await waitFor(() =>
      expect(
        getByText('Doğrulama bağlantısı geçersiz veya süresi dolmuş olabilir.')
      ).toBeTruthy()
    );
    expect(queryByText('raw backend error')).toBeNull();
  });
});
