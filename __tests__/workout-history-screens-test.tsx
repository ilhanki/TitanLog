import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { appStrings } from '@/constants/strings';
import type {
  CompletedWorkoutDetail,
  CompletedWorkoutHistoryItem,
} from '@/features/workouts/domain/models';
import { CompletedWorkoutDetailScreen } from '@/features/workouts/screens/completed-workout-detail-screen';
import { WorkoutHistoryScreen } from '@/features/workouts/screens/workout-history-screen';

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};
const mockDatabase = {};
const mockGetHistory = jest.fn();
const mockGetCount = jest.fn();
const mockGetDetail = jest.fn();
const mockDeleteCompletedSession = jest.fn();
let mockParams = { sessionId: '10' };

const historyItem: CompletedWorkoutHistoryItem = {
  completedAt: '2026-07-28T19:12:00.000Z',
  completedSetCount: 1,
  durationMinutes: 72,
  id: 10,
  startedAt: '2026-07-28T18:00:00.000Z',
  totalRepetitions: 10,
  totalVolume: 175,
  workoutDayId: 1,
  workoutName: 'Sırt + Biceps',
};

const detail: CompletedWorkoutDetail = {
  ...historyItem,
  comparison: {
    completedSetDifference: 0,
    durationDifferenceMinutes: 12,
    previousCompletedAt: '2026-07-21T19:00:00.000Z',
    previousSessionId: 9,
    totalRepetitionDifference: 2,
    totalVolumeDifference: 65,
    volumePercentageDifference: 37.1,
  },
  exercises: [
    {
      completedSetCount: 1,
      exerciseId: 2,
      id: 20,
      muscleGroup: 'Biceps',
      name: 'Dumbbell Curl',
      sets: [
        {
          actualReps: 10,
          completedAt: '2026-07-28T18:30:00.000Z',
          id: 30,
          isCompleted: true,
          setNumber: 1,
          targetReps: 12,
          weightKg: 17.5,
        },
        {
          actualReps: 12,
          completedAt: null,
          id: 31,
          isCompleted: false,
          setNumber: 2,
          targetReps: 12,
          weightKg: 17.5,
        },
      ],
      sortOrder: 1,
      totalRepetitions: 10,
      totalVolume: 175,
      weightMode: 'per_hand',
    },
  ],
};

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
    useLocalSearchParams: () => mockParams,
    useRouter: () => mockRouter,
  };
});
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDatabase,
}));
jest.mock('@/features/workouts/data/workout-session-repository', () => ({
  createWorkoutSessionRepository: () => ({
    getCompletedSessionCount: mockGetCount,
    getCompletedWorkoutDetail: mockGetDetail,
    getCompletedWorkoutHistory: mockGetHistory,
    deleteCompletedSession: mockDeleteCompletedSession,
  }),
}));

describe('workout history screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { sessionId: '10' };
    mockGetHistory.mockResolvedValue([historyItem]);
    mockGetCount.mockResolvedValue(1);
    mockGetDetail.mockResolvedValue(detail);
    mockDeleteCompletedSession.mockResolvedValue(undefined);
  });

  it('renders completed history and opens a read-only detail', async () => {
    const { getByRole, getByText } = await render(<WorkoutHistoryScreen />);

    await waitFor(() => expect(getByText('Sırt + Biceps')).toBeTruthy());
    expect(getByText(/1 set · 175 kg · 1 sa 12 dk/)).toBeTruthy();
    await fireEvent.press(
      getByRole('button', {
        name: `${appStrings.workout.openWorkoutDetails}: Sırt + Biceps`,
      })
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/workout/history/10');
  });

  it('renders a truthful empty history state', async () => {
    mockGetHistory.mockResolvedValue([]);
    mockGetCount.mockResolvedValue(0);
    const { getByText } = await render(<WorkoutHistoryScreen />);

    await waitFor(() =>
      expect(getByText(appStrings.workout.noHistoryTitle)).toBeTruthy()
    );
  });

  it('loads the next stable history page without replacing existing rows', async () => {
    const olderWorkout = {
      ...historyItem,
      completedAt: '2026-07-21T19:00:00.000Z',
      id: 9,
    };
    mockGetHistory
      .mockResolvedValueOnce([historyItem])
      .mockResolvedValueOnce([olderWorkout]);
    mockGetCount.mockResolvedValue(2);
    const { getAllByText, getByRole } = await render(<WorkoutHistoryScreen />);

    await waitFor(() =>
      expect(
        getByRole('button', { name: appStrings.workout.loadMoreHistory })
      ).toBeTruthy()
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.workout.loadMoreHistory })
    );

    await waitFor(() => expect(getAllByText('Sırt + Biceps')).toHaveLength(2));
    expect(mockGetHistory).toHaveBeenLastCalledWith(20, 1);
  });

  it('renders completed snapshots, comparison, and no edit actions', async () => {
    const { getByLabelText, getByRole, getByText, queryByRole, toJSON } =
      await render(<CompletedWorkoutDetailScreen />);

    await waitFor(() => expect(getByText('Sırt + Biceps')).toBeTruthy());
    expect(getByText('1 sa 12 dk')).toBeTruthy();
    expect(getByText(appStrings.workout.comparisonTitle)).toBeTruthy();
    expect(getByText('+65 kg · artış (+37,1 %)')).toBeTruthy();
    expect(
      getByLabelText('Dumbbell Curl, Set 1, 10 tekrar, 17,5 kg, Tamamlandı')
    ).toBeTruthy();
    expect(getByLabelText('Dumbbell Curl, Set 2, Tamamlanmadı')).toBeTruthy();
    expect(
      queryByRole('button', { name: appStrings.workout.saveSet })
    ).toBeNull();
    expect(
      queryByRole('button', { name: appStrings.workout.removeSet })
    ).toBeNull();
    await fireEvent.press(
      getByRole('button', {
        name: `Dumbbell Curl: ${appStrings.workout.exerciseHistoryAction}`,
      })
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/workout/exercise/2/history');
    expect(JSON.stringify(toJSON())).not.toContain('"horizontal":true');
  });

  it('rejects an invalid completed-session ID without querying SQLite', async () => {
    mockParams = { sessionId: 'invalid' };
    const { getByText } = await render(<CompletedWorkoutDetailScreen />);

    await waitFor(() =>
      expect(getByText(appStrings.workout.detailNotFound)).toBeTruthy()
    );
    expect(mockGetDetail).not.toHaveBeenCalled();
  });

  it('deletes a completed workout only after destructive confirmation', async () => {
    jest.spyOn(Alert, 'alert');
    const { getByRole, getByText } = await render(
      <CompletedWorkoutDetailScreen />
    );

    await waitFor(() => expect(getByText('Sırt + Biceps')).toBeTruthy());
    await fireEvent.press(
      getByRole('button', {
        name: appStrings.workout.deleteCompletedWorkout,
      })
    );

    expect(Alert.alert).toHaveBeenCalledWith(
      appStrings.workout.deleteCompletedWorkoutTitle,
      expect.stringContaining('Sırt + Biceps'),
      expect.any(Array)
    );
    expect(mockDeleteCompletedSession).not.toHaveBeenCalled();

    const buttons = (Alert.alert as jest.Mock).mock.calls[0]?.[2];
    await act(async () => buttons[1].onPress());

    await waitFor(() =>
      expect(mockDeleteCompletedSession).toHaveBeenCalledWith(10)
    );
    expect(mockDeleteCompletedSession).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/workout/history');
  });

  it('keeps the detail visible and reports a safe error when deletion fails', async () => {
    jest.spyOn(Alert, 'alert');
    mockDeleteCompletedSession.mockRejectedValue(
      new Error('database unavailable')
    );
    const { getByRole, getByText } = await render(
      <CompletedWorkoutDetailScreen />
    );

    await waitFor(() => expect(getByText('Sırt + Biceps')).toBeTruthy());
    await fireEvent.press(
      getByRole('button', {
        name: appStrings.workout.deleteCompletedWorkout,
      })
    );
    const buttons = (Alert.alert as jest.Mock).mock.calls[0]?.[2];
    await act(async () => buttons[1].onPress());

    await waitFor(() =>
      expect(
        getByText(appStrings.workout.deleteCompletedWorkoutError)
      ).toBeTruthy()
    );
    expect(getByText('Sırt + Biceps')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('shows an honest repository error and retry action', async () => {
    mockGetHistory.mockRejectedValue(new Error('database unavailable'));
    const { getByRole, getByText } = await render(<WorkoutHistoryScreen />);

    await waitFor(() =>
      expect(getByText(appStrings.workout.historyLoadError)).toBeTruthy()
    );
    expect(
      getByRole('button', { name: appStrings.workout.retry })
    ).toBeTruthy();
  });
});
