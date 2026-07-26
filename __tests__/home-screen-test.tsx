import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import { HomeScreen } from '@/features/home/home-screen';

const mockRouter = {
  navigate: jest.fn(),
  push: jest.fn(),
};
const mockStartSession = jest.fn();

const mockOverview = {
  data: {
    activeSession: null,
    completedSessionCount: 0,
    plan: null,
    recentSessions: [],
    scheduledWorkout: {
      exerciseCount: 7,
      exercisePreview: ['Lat Pulldown'],
      exercises: [],
      id: 1,
      name: 'Sırt + Biceps',
      scheduleWeekdays: [1, 4],
      sortOrder: 1,
      subtitle: 'Sırt ve kol',
    },
  },
  error: false,
  loading: false,
  retry: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({}),
}));
jest.mock('@/features/workouts/hooks/use-workout-overview', () => ({
  useWorkoutOverview: () => mockOverview,
}));
jest.mock('@/features/workouts/data/workout-session-repository', () => ({
  createWorkoutSessionRepository: () => ({
    startSessionFromWorkoutDay: mockStartSession,
  }),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartSession.mockResolvedValue({ id: 88 });
  });

  it('renders real empty workout values without a personal name or fake 36', async () => {
    const { getByRole, getByText, queryByText } = await render(<HomeScreen />);

    expect(getByText(appStrings.brandName)).toBeTruthy();
    expect(
      getByRole('header', { name: appStrings.home.welcomeTitle })
    ).toBeTruthy();
    expect(queryByText(/İlhan/i)).toBeNull();
    expect(queryByText('36')).toBeNull();
    expect(getByText('Sırt + Biceps')).toBeTruthy();
    expect(getByText(appStrings.home.noLastWorkout)).toBeTruthy();
  });

  it('navigates to the sign-up screen from the account entry card', async () => {
    const { getByRole } = await render(<HomeScreen />);

    fireEvent.press(getByRole('button', { name: appStrings.auth.signUp }));

    expect(mockRouter.push).toHaveBeenCalledWith('/auth/sign-up');
  });

  it('starts the scheduled workout and opens its persistent session', async () => {
    const { getByRole } = await render(<HomeScreen />);

    await act(async () => {
      fireEvent.press(
        getByRole('button', { name: appStrings.home.startWorkout })
      );
    });

    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith('/workout/session/88');
    });
  });
});
