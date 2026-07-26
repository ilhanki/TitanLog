import { render } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import { ProfileScreen } from '@/features/profile/profile-screen';
import { ProgressScreen } from '@/features/progress/progress-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('product-facing placeholder screens', () => {
  it.each([
    [
      'progress',
      <ProgressScreen key="progress" />,
      appStrings.progress.emptyTitle,
      appStrings.progress.description,
    ],
    [
      'profile',
      <ProfileScreen key="profile" />,
      appStrings.profile.emptyTitle,
      appStrings.profile.description,
    ],
  ])(
    'renders polished %s copy without implementation language',
    async (_name, screen, title, description) => {
      const { getByText, queryByText } = await render(screen);

      expect(getByText(title)).toBeTruthy();
      expect(getByText(description)).toBeTruthy();
      expect(queryByText(/sprint|bu sürümde|kalıcı veri/i)).toBeNull();
    }
  );
});
