import { render, waitFor } from '@testing-library/react-native';

import { ProfileScreen } from '@/features/profile/profile-screen';

jest.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({ configured: false, initializing: false, user: null }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, []);
  },
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({}),
}));
jest.mock('@/features/profile/profile-preferences', () => ({
  PROFILE_FALLBACK_NAME: 'Titan Sporcusu',
  createProfilePreferencesRepository: () => ({
    get: jest.fn().mockResolvedValue({
      avatarUri: null,
      displayName: null,
      weeklyActiveDayTarget: null,
      weeklyWorkoutTarget: null,
      weightUnit: 'kg',
    }),
  }),
}));
jest.mock('@/features/insights/profile-insights', () => ({
  ProfileInsights: () => null,
}));
jest.mock('@/features/data-safety/dataset-ownership-repository', () => ({
  createDatasetOwnershipRepository: () => ({
    getOwnership: jest.fn().mockResolvedValue({
      installationId: 'device',
      lastCloudBackupAt: null,
      lastLocalBackupAt: null,
      ownerAccountId: null,
    }),
  }),
}));

describe('product-facing placeholder screens', () => {
  it.each([
    [
      'profile',
      <ProfileScreen key="profile" />,
      'Titan Sporcusu',
      'Misafir profili · yalnızca bu cihazda',
    ],
  ])(
    'renders polished %s copy without implementation language',
    async (_name, screen, title, description) => {
      const { getByText, queryByText } = await render(screen);

      expect(getByText(title)).toBeTruthy();
      await waitFor(() => expect(getByText(description)).toBeTruthy());
      expect(queryByText(/sprint|bu sürümde|kalıcı veri/i)).toBeNull();
    }
  );
});
