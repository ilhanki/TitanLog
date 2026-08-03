import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PropsWithChildren } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import {
  clearAuthNavigationState,
  getAuthNavigationStateSnapshot,
  requestPostAuthDestination,
  resetAuthNavigationStateForTests,
} from '@/features/auth/auth-navigation-state';
import { PostAuthDestinationConsumer } from '@/features/auth/post-auth-destination-consumer';
import { getAuthRouteActivation } from '@/features/auth/auth-route-activation';
import { SignInScreen } from '@/features/auth/sign-in-screen';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockSignIn = jest.fn();
let mockDatasetAccess: 'checking' | 'granted' = 'granted';
let mockAuthState: {
  configured: boolean;
  initializing: boolean;
  session: { user: { id: string } } | null;
  user: { id: string } | null;
} = {
  configured: true,
  initializing: false,
  session: null,
  user: null,
};

jest.mock('expo-router', () => ({
  Link: ({ children }: PropsWithChildren) => children,
  useRouter: () => mockRouter,
}));
jest.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => mockAuthState,
}));
jest.mock('@/features/data-safety/dataset-access-guard', () => ({
  useDatasetAccess: () => ({ state: mockDatasetAccess }),
}));
jest.mock('@/features/auth/auth-service', () => ({
  requestPasswordReset: jest.fn(),
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

function setAuthenticated() {
  mockAuthState = {
    configured: true,
    initializing: false,
    session: { user: { id: 'verified-user' } },
    user: { id: 'verified-user' },
  };
}

async function fillAndSubmit(view: Awaited<ReturnType<typeof render>>) {
  await fireEvent.changeText(
    view.getByLabelText(appStrings.auth.emailLabel),
    'verified@example.com'
  );
  await fireEvent.changeText(
    view.getByLabelText(appStrings.auth.passwordLabel),
    'safe-password'
  );
  await fireEvent.press(
    view.getByRole('button', { name: appStrings.auth.signIn })
  );
}

describe('authenticated route activation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthNavigationStateForTests();
    mockDatasetAccess = 'granted';
    mockAuthState = {
      configured: true,
      initializing: false,
      session: null,
      user: null,
    };
    mockSignIn.mockResolvedValue(undefined);
  });

  it('keeps route availability deterministic through loading and ownership checks', () => {
    expect(
      getAuthRouteActivation({
        authenticated: false,
        datasetAccess: 'checking',
        flow: 'standard',
        initializing: true,
        passwordResetLink: false,
      })
    ).toMatchObject({ loading: true });

    expect(
      getAuthRouteActivation({
        authenticated: true,
        datasetAccess: 'checking',
        flow: 'standard',
        initializing: false,
        passwordResetLink: false,
      })
    ).toEqual({
      datasetAccessRouteAvailable: true,
      loading: false,
      localRoutesAvailable: false,
      passwordResetRouteAvailable: false,
      signedOutAuthRoutesAvailable: false,
    });

    expect(
      getAuthRouteActivation({
        authenticated: true,
        datasetAccess: 'granted',
        flow: 'standard',
        initializing: false,
        passwordResetLink: false,
      })
    ).toMatchObject({
      datasetAccessRouteAvailable: false,
      localRoutesAvailable: true,
      signedOutAuthRoutesAvailable: false,
    });
  });

  it('holds reset routes until recovery completes and then activates tabs', () => {
    expect(
      getAuthRouteActivation({
        authenticated: true,
        datasetAccess: 'granted',
        flow: 'password_recovery',
        initializing: false,
        passwordResetLink: true,
      })
    ).toMatchObject({
      localRoutesAvailable: false,
      passwordResetRouteAvailable: true,
    });

    expect(
      getAuthRouteActivation({
        authenticated: true,
        datasetAccess: 'granted',
        flow: 'password_recovery_complete',
        initializing: false,
        passwordResetLink: true,
      })
    ).toMatchObject({
      localRoutesAvailable: true,
      passwordResetRouteAvailable: false,
    });
  });

  it('reproduces the physical sign-in race without dispatching before tabs activate', async () => {
    const view = await render(
      <>
        <SignInScreen />
        <PostAuthDestinationConsumer />
      </>
    );
    await fillAndSubmit(view);

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(
      getAuthNavigationStateSnapshot().pendingDestination?.destination
    ).toBe('profile');

    setAuthenticated();
    mockDatasetAccess = 'checking';
    await view.rerender(
      <>
        <SignInScreen />
        <PostAuthDestinationConsumer />
      </>
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();

    mockDatasetAccess = 'granted';
    await view.rerender(<PostAuthDestinationConsumer />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));

    const [destination, nestedParams] = mockRouter.replace.mock.calls[0] ?? [];
    expect(destination).toBe('/(tabs)/profile');
    expect(nestedParams).toBeUndefined();
    expect(mockRouter.replace.mock.calls).not.toContainEqual([
      {
        name: '(tabs)',
        params: { params: {}, screen: 'profile' },
      },
    ]);
    expect(getAuthNavigationStateSnapshot().pendingDestination).toBeNull();
  });

  it('deduplicates rapid sign-in taps and consumes one destination', async () => {
    let resolveSignIn!: () => void;
    mockSignIn.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSignIn = resolve;
      })
    );
    const view = await render(<SignInScreen />);
    await fireEvent.changeText(
      view.getByLabelText(appStrings.auth.emailLabel),
      'verified@example.com'
    );
    await fireEvent.changeText(
      view.getByLabelText(appStrings.auth.passwordLabel),
      'safe-password'
    );
    const button = view.getByRole('button', { name: appStrings.auth.signIn });
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(mockSignIn).toHaveBeenCalledTimes(1);

    resolveSignIn();
    setAuthenticated();
    mockDatasetAccess = 'granted';
    await render(<PostAuthDestinationConsumer />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
  });

  it('keeps failed sign-in on screen and clears pending navigation', async () => {
    mockSignIn.mockRejectedValue(new Error('unsafe remote detail'));
    const view = await render(<SignInScreen />);
    await fillAndSubmit(view);

    await waitFor(() =>
      expect(view.getByText(appStrings.auth.safeError)).toBeTruthy()
    );
    expect(getAuthNavigationStateSnapshot().pendingDestination).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('does not navigate a restored session without an explicit destination', async () => {
    setAuthenticated();
    await render(<PostAuthDestinationConsumer />);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('consumes a destination once across repeated auth events and effects', async () => {
    requestPostAuthDestination('profile');
    setAuthenticated();
    const view = await render(<PostAuthDestinationConsumer />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));

    await view.rerender(<PostAuthDestinationConsumer />);
    await view.rerender(<PostAuthDestinationConsumer />);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('clears pending navigation during sign-out state reset', () => {
    requestPostAuthDestination('profile');
    clearAuthNavigationState();
    expect(getAuthNavigationStateSnapshot()).toEqual({
      flow: 'standard',
      pendingDestination: null,
    });
  });

  it('falls back safely when an invalid destination reaches the runtime boundary', () => {
    requestPostAuthDestination(
      'https://untrusted.example/callback' as unknown as 'profile'
    );
    expect(
      getAuthNavigationStateSnapshot().pendingDestination?.destination
    ).toBe('profile');
  });

  it('keeps auth activation free of automatic fitness-data side effects', () => {
    const source = [
      'src/features/auth/sign-in-screen.tsx',
      'src/features/auth/auth-navigation-state.ts',
      'src/features/auth/post-auth-destination-consumer.tsx',
    ]
      .map((path) => readFileSync(join(process.cwd(), path), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(
      /claimDataset|uploadCloudBackup|pushManualSync|pullManualSync|SQLite/i
    );
  });
});
