import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import type { BodyOverview } from '@/features/body/hooks/use-body-overview';
import { HomeScreen } from '@/features/home/home-screen';
import type { CompletedWorkoutSummary } from '@/features/workouts/domain/models';

const mockRouter = {
  navigate: jest.fn(),
  push: jest.fn(),
};
const mockStartSession = jest.fn();
let mockBodyOverview: {
  data: BodyOverview;
  error: boolean;
  loading: boolean;
  retry: jest.Mock;
} = {
  data: {
    latest: null,
    measurements: [],
    previous: null,
    profile: null,
    progress: null,
  },
  error: false,
  loading: false,
  retry: jest.fn(),
};

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
      totalSetCount: 21,
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
jest.mock('@/features/body/hooks/use-body-overview', () => ({
  useBodyOverview: () => mockBodyOverview,
}));
jest.mock('@/features/workouts/data/workout-session-repository', () => ({
  createWorkoutSessionRepository: () => ({
    startSessionFromWorkoutDay: mockStartSession,
  }),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOverview.data.recentSessions.splice(0);
    mockStartSession.mockResolvedValue({ id: 88 });
    mockBodyOverview = {
      data: {
        latest: null,
        measurements: [],
        previous: null,
        profile: null,
        progress: null,
      },
      error: false,
      loading: false,
      retry: jest.fn(),
    };
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
    expect(getByText(appStrings.progress.setupCtaTitle)).toBeTruthy();
    expect(queryByText(/119,6|114,8|99,9/)).toBeNull();
  });

  it('renders persisted body profile values', async () => {
    mockBodyOverview = {
      data: {
        latest: null,
        measurements: [],
        previous: null,
        profile: {
          createdAt: '2026-08-01T10:00:00.000Z',
          id: 1,
          startingWeightKg: 80,
          targetWeightKg: 70,
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
        progress: {
          changeFromPreviousKg: -1,
          currentWeightKg: 75,
          direction: 'loss' as const,
          progress: 0.5,
          progressPercentage: 50,
          remainingWeightKg: 5,
          targetReached: false,
          totalChangeKg: -5,
        },
      },
      error: false,
      loading: false,
      retry: jest.fn(),
    };

    const { getAllByText, getByText } = await render(<HomeScreen />);

    expect(getAllByText('75 kg').length).toBeGreaterThan(0);
    expect(getAllByText('70 kg').length).toBeGreaterThan(0);
    expect(getByText('%50 tamamlandı')).toBeTruthy();
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

  it('opens the latest completed workout from Home', async () => {
    const latestWorkout: CompletedWorkoutSummary = {
      completedAt: '2026-07-28T19:12:00.000Z',
      completedSetCount: 19,
      durationMinutes: 72,
      exerciseNames: ['Lat Pulldown'],
      id: 77,
      startedAt: '2026-07-28T18:00:00.000Z',
      totalRepetitions: 228,
      totalVolume: 8640,
      workoutDayId: 1,
      workoutName: 'Sırt + Biceps',
    };
    mockOverview.data.recentSessions.push(latestWorkout as never);
    const { getByRole } = await render(<HomeScreen />);

    await fireEvent.press(
      getByRole('button', {
        name: `${appStrings.workout.openWorkoutDetails}: Sırt + Biceps`,
      })
    );

    expect(mockRouter.navigate).toHaveBeenCalledWith('/workout/history/77');
  });
});
