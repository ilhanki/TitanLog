import type { PropsWithChildren } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import { SignInScreen } from '@/features/auth/sign-in-screen';
import { SignUpScreen } from '@/features/auth/sign-up-screen';

const mockRouter = {
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  Link: ({ children }: PropsWithChildren) => children,
  useRouter: () => mockRouter,
}));

describe('authentication interface screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the required sign-in fields', async () => {
    const { getByLabelText, getByRole } = await render(<SignInScreen />);

    expect(getByRole('header', { name: appStrings.auth.signIn })).toBeTruthy();
    expect(getByLabelText(appStrings.auth.emailLabel)).toBeTruthy();
    expect(getByLabelText(appStrings.auth.passwordLabel)).toBeTruthy();
  });

  it('renders the required sign-up fields', async () => {
    const { getByLabelText, getByRole } = await render(<SignUpScreen />);

    expect(getByRole('header', { name: appStrings.auth.signUp })).toBeTruthy();
    expect(getByLabelText(appStrings.auth.nameLabel)).toBeTruthy();
    expect(getByLabelText(appStrings.auth.emailLabel)).toBeTruthy();
    expect(getByLabelText(appStrings.auth.passwordLabel)).toBeTruthy();
    expect(
      getByLabelText(appStrings.auth.passwordConfirmationLabel)
    ).toBeTruthy();
  });

  it('shows a development notice instead of pretending to sign in', async () => {
    const { getByLabelText, getByRole, getByText } = await render(
      <SignInScreen />
    );

    await fireEvent.changeText(
      getByLabelText(appStrings.auth.emailLabel),
      'test@example.com'
    );
    await fireEvent.changeText(
      getByLabelText(appStrings.auth.passwordLabel),
      'not-a-real-password'
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.auth.signIn })
    );

    expect(getByText(appStrings.auth.developmentNotice)).toBeTruthy();
  });

  it('shows a truthful notice for unavailable password recovery', async () => {
    const { getByRole, getByText } = await render(<SignInScreen />);

    await fireEvent.press(
      getByRole('button', { name: appStrings.auth.forgotPassword })
    );

    expect(getByText(appStrings.auth.passwordResetNotice)).toBeTruthy();
  });

  it('validates password confirmation without creating an account', async () => {
    const { getByLabelText, getByRole, getByText, queryByText } = await render(
      <SignUpScreen />
    );

    await fireEvent.changeText(
      getByLabelText(appStrings.auth.nameLabel),
      'Test Kullanıcısı'
    );
    await fireEvent.changeText(
      getByLabelText(appStrings.auth.emailLabel),
      'test@example.com'
    );
    await fireEvent.changeText(
      getByLabelText(appStrings.auth.passwordLabel),
      'password-one'
    );
    await fireEvent.changeText(
      getByLabelText(appStrings.auth.passwordConfirmationLabel),
      'password-two'
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.auth.signUp })
    );

    expect(getByText(appStrings.auth.validation.passwordMismatch)).toBeTruthy();
    expect(queryByText(appStrings.auth.developmentNotice)).toBeNull();
  });
});
