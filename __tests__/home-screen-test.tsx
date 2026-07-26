import { fireEvent, render } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import { HomeScreen } from '@/features/home/home-screen';

const mockRouter = {
  navigate: jest.fn(),
  push: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the generic TitanLog dashboard without a personal name', async () => {
    const { getByRole, getByText, queryByText } = await render(<HomeScreen />);

    expect(getByText(appStrings.brandName)).toBeTruthy();
    expect(
      getByRole('header', { name: appStrings.home.welcomeTitle })
    ).toBeTruthy();
    expect(queryByText(/İlhan/i)).toBeNull();
    expect(getByText(appStrings.home.todayWorkoutLabel)).toBeTruthy();
    expect(getByText('Sırt + Biceps')).toBeTruthy();
    expect(getByRole('button', { name: appStrings.auth.signIn })).toBeTruthy();
    expect(getByRole('button', { name: appStrings.auth.signUp })).toBeTruthy();
  });

  it('navigates to the sign-up screen from the account entry card', async () => {
    const { getByRole } = await render(<HomeScreen />);

    await fireEvent.press(
      getByRole('button', { name: appStrings.auth.signUp })
    );

    expect(mockRouter.push).toHaveBeenCalledWith('/auth/sign-up');
  });

  it('navigates to the workout tab from the start action', async () => {
    const { getByRole } = await render(<HomeScreen />);

    await fireEvent.press(
      getByRole('button', { name: appStrings.home.startWorkout })
    );

    expect(mockRouter.navigate).toHaveBeenCalledWith('/workout');
  });
});
