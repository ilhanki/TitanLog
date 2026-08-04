import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { appStrings } from '@/constants/strings';
import type { ExerciseHistory } from '@/features/workouts/domain/exercise-performance';
import { ExerciseHistoryScreen } from '@/features/workouts/screens/exercise-history-screen';

const mockRouter = {
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  replace: jest.fn(),
};
const mockDatabase = {};
const mockGetExerciseHistory = jest.fn();
let mockParams = { exerciseId: '11' };

const history: ExerciseHistory = {
  equipment: 'Dumbbell',
  exerciseId: 11,
  exerciseName: 'Dumbbell Curl',
  hasMore: false,
  legacyMatched: false,
  muscleGroup: 'Biceps',
  recentAppearances: [
    {
      completedAt: '2026-07-30T18:00:00.000Z',
      completedSetCount: 2,
      exerciseId: 11,
      highestWeightKg: 20,
      legacyMatched: false,
      sessionExerciseId: 101,
      sessionId: 10,
      sets: [
        { actualReps: 12, setNumber: 1, weightKg: 17.5 },
        { actualReps: 10, setNumber: 2, weightKg: 20 },
      ],
      totalRepetitions: 22,
      totalVolume: 410,
      weightMode: 'per_hand',
      workoutName: 'Sırt + Biceps',
    },
  ],
  records: {
    appearanceCount: 1,
    highestRepetitions: {
      achievedAt: '2026-07-30T18:00:00.000Z',
      sessionId: 10,
      value: 12,
    },
    highestSessionVolume: {
      achievedAt: '2026-07-30T18:00:00.000Z',
      sessionId: 10,
      value: 410,
    },
    highestWeight: {
      achievedAt: '2026-07-30T18:00:00.000Z',
      sessionId: 10,
      value: 20,
    },
    lastPerformance: null,
    legacyMatched: false,
  },
  weightMode: 'per_hand',
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
jest.mock('@/features/workouts/data/exercise-performance-repository', () => ({
  createExercisePerformanceRepository: () => ({
    getExerciseHistory: mockGetExerciseHistory,
  }),
}));

describe('exercise history screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { exerciseId: '11' };
    mockGetExerciseHistory.mockResolvedValue(history);
  });

  it('renders ordered completed sets and records as a read-only screen', async () => {
    const { getAllByText, getByText, queryByRole, toJSON } = await render(
      <ExerciseHistoryScreen />
    );

    await waitFor(() => expect(getByText('Dumbbell Curl')).toBeTruthy());
    expect(getAllByText('20 kg').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('12 tekrar').length).toBeGreaterThanOrEqual(1);
    expect(getByText('410 kg')).toBeTruthy();
    expect(getByText('17,5 kg')).toBeTruthy();
    expect(getByText(/20 kg en yüksek/)).toBeTruthy();
    expect(getByText(/her el/)).toBeTruthy();
    expect(
      queryByRole('button', { name: appStrings.workout.markComplete })
    ).toBeNull();
    expect(JSON.stringify(toJSON())).not.toContain('"horizontal":true');
    expect(JSON.stringify(toJSON())).not.toContain('"keyboardType"');
  });

  it('shows unavailable records and the truthful empty state', async () => {
    mockGetExerciseHistory.mockResolvedValue({
      ...history,
      recentAppearances: [],
      records: {
        appearanceCount: 0,
        highestRepetitions: null,
        highestSessionVolume: null,
        highestWeight: null,
        lastPerformance: null,
        legacyMatched: false,
      },
    });
    const { getAllByText, getByText } = await render(<ExerciseHistoryScreen />);

    await waitFor(() =>
      expect(getByText(appStrings.workout.exerciseHistoryEmpty)).toBeTruthy()
    );
    expect(getAllByText('—')).toHaveLength(4);
  });

  it('loads and deduplicates the next page after rapid presses', async () => {
    const secondAppearance = {
      ...history.recentAppearances[0]!,
      completedAt: '2026-07-20T18:00:00.000Z',
      sessionExerciseId: 99,
      sessionId: 9,
      workoutName: 'Kol Günü',
    };
    mockGetExerciseHistory
      .mockResolvedValueOnce({ ...history, hasMore: true })
      .mockResolvedValueOnce({
        ...history,
        hasMore: false,
        recentAppearances: [history.recentAppearances[0]!, secondAppearance],
      });
    const { getAllByText, getByRole, getByText } = await render(
      <ExerciseHistoryScreen />
    );

    const loadMore = await waitFor(() =>
      getByRole('button', { name: appStrings.workout.loadMoreExerciseHistory })
    );
    await fireEvent.press(loadMore);
    await fireEvent.press(loadMore);

    await waitFor(() => expect(getByText(/Kol Günü/)).toBeTruthy());
    expect(mockGetExerciseHistory).toHaveBeenCalledTimes(2);
    expect(mockGetExerciseHistory).toHaveBeenLastCalledWith(11, 20, 1);
    expect(getAllByText(/Sırt \+ Biceps/)).toHaveLength(1);
  });

  it('rejects an invalid exercise ID without querying SQLite', async () => {
    mockParams = { exerciseId: 'invalid' };
    const { getByText } = await render(<ExerciseHistoryScreen />);

    await waitFor(() =>
      expect(getByText(appStrings.workout.exerciseHistoryNotFound)).toBeTruthy()
    );
    expect(mockGetExerciseHistory).not.toHaveBeenCalled();
  });

  it('shows legacy matching transparently and supports back navigation', async () => {
    mockGetExerciseHistory.mockResolvedValue({
      ...history,
      legacyMatched: true,
    });
    const { getByRole, getByText } = await render(<ExerciseHistoryScreen />);

    await waitFor(() =>
      expect(
        getByText(appStrings.workout.legacyExerciseHistoryNote)
      ).toBeTruthy()
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.common.goBack })
    );
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});
