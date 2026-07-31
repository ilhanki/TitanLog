import { render, waitFor } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
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
  useSQLiteContext: () => ({
    getFirstAsync: jest.fn().mockResolvedValue({
      installation_id: 'device',
      last_cloud_backup_at: null,
      last_local_backup_at: null,
      owner_account_id: null,
    }),
  }),
}));

describe('product-facing placeholder screens', () => {
  it.each([
    [
      'profile',
      <ProfileScreen key="profile" />,
      'Hesap',
      'Misafir olarak kullanılıyor',
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
