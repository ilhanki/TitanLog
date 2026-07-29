import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import { WorkoutExerciseRow } from '@/features/workouts/components/workout-exercise-row';
import { ActiveWorkoutScreen } from '@/features/workouts/screens/active-workout-screen';
import { WorkoutDayScreen } from '@/features/workouts/screens/workout-day-screen';
import { WorkoutScreen } from '@/features/workouts/screens/workout-screen';

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};
const mockDatabase = {};
const mockGetWorkoutDayDetails = jest.fn();
const mockGetActiveSession = jest.fn();
const mockGetSessionDetails = jest.fn();
const mockStartSession = jest.fn();
const mockCompleteSet = jest.fn();
const mockAddSet = jest.fn();
const mockRemoveSet = jest.fn();
const mockUpdateSetValues = jest.fn();
const mockUseWorkoutOverview = jest.fn();
const mockGetActiveExercisePerformance = jest.fn();
let mockLocalParams = { dayId: '1', sessionId: '9' };

const workoutDay = {
  exerciseCount: 1,
  exercisePreview: ['Dumbbell Curl'],
  exercises: [
    {
      equipment: 'Dumbbell',
      id: 11,
      muscleGroup: 'Biceps',
      name: 'Dumbbell Curl',
      setCount: 3,
      sortOrder: 1,
      targetReps: 12,
      weightKg: 17.5,
      weightMode: 'per_hand' as const,
    },
  ],
  id: 1,
  name: 'Sırt + Biceps',
  scheduleWeekdays: [1, 4],
  sortOrder: 1,
  totalSetCount: 3,
  subtitle: 'Sırt ve kol',
};

const activeSession = {
  cancelledAt: null,
  completedAt: null,
  exercises: [
    {
      exerciseId: 11,
      id: 21,
      muscleGroup: 'Biceps',
      name: 'Dumbbell Curl',
      sets: [
        {
          actualReps: 12,
          completedAt: null,
          id: 31,
          isCompleted: false,
          setNumber: 1,
          targetReps: 12,
          weightKg: 17.5,
        },
      ],
      sortOrder: 1,
      weightMode: 'per_hand' as const,
    },
  ],
  id: 9,
  startedAt: '2026-07-31T10:00:00.000Z',
  status: 'active' as const,
  workoutDayId: 1,
  workoutName: 'Sırt + Biceps',
};

const baseOverview = {
  data: {
    activeSession: null,
    completedSessionCount: 0,
    plan: {
      days: [workoutDay],
      description: 'Başlangıç',
      id: 1,
      name: 'Titan',
    },
    recentSessions: [],
    scheduledWorkout: workoutDay,
  },
  error: false,
  loading: false,
  retry: jest.fn(),
};

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
    useLocalSearchParams: () => mockLocalParams,
    useRouter: () => mockRouter,
  };
});
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDatabase,
}));
jest.mock('@/features/workouts/hooks/use-workout-overview', () => ({
  useWorkoutOverview: (now?: Date) => mockUseWorkoutOverview(now),
}));
jest.mock('@/features/workouts/data/workout-plan-repository', () => ({
  createWorkoutPlanRepository: () => ({
    getWorkoutDayDetails: mockGetWorkoutDayDetails,
  }),
}));
jest.mock('@/features/workouts/data/workout-session-repository', () => {
  class MockWorkoutSessionError extends Error {
    code = 'session_not_active';
  }
  return {
    WorkoutSessionError: MockWorkoutSessionError,
    createWorkoutSessionRepository: () => ({
      addSet: mockAddSet,
      cancelSession: jest.fn(),
      completeSetAndPrefillNext: mockCompleteSet,
      completeSession: jest.fn(),
      getActiveSession: mockGetActiveSession,
      getSessionDetails: mockGetSessionDetails,
      removeLastIncompleteSet: mockRemoveSet,
      startSessionFromWorkoutDay: mockStartSession,
      toggleSetCompletion: jest.fn(),
      updateSetValues: mockUpdateSetValues,
    }),
  };
});
jest.mock('@/features/workouts/data/exercise-performance-repository', () => ({
  createExercisePerformanceRepository: () => ({
    getActiveExercisePerformance: mockGetActiveExercisePerformance,
  }),
}));

describe('workout screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalParams = { dayId: '1', sessionId: '9' };
    mockUseWorkoutOverview.mockReturnValue(baseOverview);
    mockGetWorkoutDayDetails.mockResolvedValue(workoutDay);
    mockGetActiveSession.mockResolvedValue(null);
    mockGetSessionDetails.mockResolvedValue(activeSession);
    mockCompleteSet.mockResolvedValue(undefined);
    mockGetActiveExercisePerformance.mockResolvedValue({
      previous: new Map(),
      records: new Map(),
    });
  });

  it('renders the seeded plan and truthful empty history', async () => {
    const { getAllByText, getByText } = await render(<WorkoutScreen />);

    expect(getAllByText('Sırt + Biceps')).toHaveLength(2);
    expect(getByText(appStrings.workout.noHistoryTitle)).toBeTruthy();
  });

  it('renders the Friday rest-day state through a controlled date', async () => {
    mockUseWorkoutOverview.mockReturnValue({
      ...baseOverview,
      data: { ...baseOverview.data, scheduledWorkout: null },
    });
    const friday = new Date(2026, 6, 31);
    const { getByText } = await render(<WorkoutScreen now={friday} />);

    expect(getByText(appStrings.workout.restTitle)).toBeTruthy();
    expect(mockUseWorkoutOverview).toHaveBeenCalledWith(friday);
  });

  it('renders workout-day exercises with defaults and per-hand weight', async () => {
    const { getByLabelText, getByText } = await render(<WorkoutDayScreen />);

    await waitFor(() => {
      expect(getByText(/Dumbbell Curl/)).toBeTruthy();
      expect(getByText('12 tk')).toBeTruthy();
      expect(getByText('17,5 kg')).toBeTruthy();
      expect(
        getByLabelText(
          'Dumbbell Curl geçmişini aç. 3 set, 12 tekrar, 17,5 kg, her el'
        )
      ).toBeTruthy();
    });
  });

  it('shows a truthful zero-exercise state and blocks workout start', async () => {
    const emptyDay = {
      ...workoutDay,
      exerciseCount: 0,
      exercises: [],
      totalSetCount: 0,
    };
    mockGetWorkoutDayDetails.mockResolvedValue(emptyDay);
    mockUseWorkoutOverview.mockReturnValue({
      ...baseOverview,
      data: { ...baseOverview.data, scheduledWorkout: emptyDay },
    });

    const overview = await render(<WorkoutScreen />);
    expect(
      overview.getByText(appStrings.workout.noExercisesStart)
    ).toBeTruthy();
    expect(
      overview.getByRole('button', { name: appStrings.workout.startWorkout })
    ).toBeDisabled();

    const detail = await render(<WorkoutDayScreen />);
    await waitFor(() =>
      expect(
        detail.getByText(appStrings.workout.noProgramExercisesTitle)
      ).toBeTruthy()
    );
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('renders the compact active-session table without legacy set cards', async () => {
    const { getByLabelText, getByText, queryByRole, queryByText, toJSON } =
      await render(<ActiveWorkoutScreen />);

    await waitFor(() => {
      expect(getByText(appStrings.workout.tableExercise)).toBeTruthy();
      expect(getByText(appStrings.workout.tableSet)).toBeTruthy();
      expect(getByText(appStrings.workout.tableWeight)).toBeTruthy();
      expect(getByText(appStrings.workout.tableRepetitions)).toBeTruthy();
      expect(
        getByLabelText(`Dumbbell Curl ${appStrings.workout.weightLabel}`)
      ).toHaveProp('value', '17,5');
      expect(
        getByLabelText(`Dumbbell Curl ${appStrings.workout.repetitionLabel}`)
      ).toHaveProp('value', '12');
    });
    expect(queryByText('Set 1')).toBeNull();
    expect(
      queryByRole('button', { name: appStrings.workout.markComplete })
    ).toBeNull();
    const renderedTable = JSON.stringify(toJSON());
    expect(renderedTable.indexOf('"children":["Tk"]')).toBeLessThan(
      renderedTable.indexOf('"children":["Kg"]')
    );
    expect(
      renderedTable.indexOf('"accessibilityLabel":"Dumbbell Curl Tekrar"')
    ).toBeLessThan(
      renderedTable.indexOf('"accessibilityLabel":"Dumbbell Curl Kilo (kg)"')
    );
    expect(renderedTable).not.toContain('"horizontal":true');
  });

  it('announces strict personal records only after a successful set write', async () => {
    const refreshedSession = {
      ...activeSession,
      exercises: [
        {
          ...activeSession.exercises[0]!,
          sets: [
            {
              ...activeSession.exercises[0]!.sets[0]!,
              completedAt: '2026-07-31T10:10:00.000Z',
              isCompleted: true,
              weightKg: 17.5,
            },
          ],
        },
      ],
    };
    mockGetSessionDetails
      .mockResolvedValueOnce(activeSession)
      .mockResolvedValue(refreshedSession);
    mockGetActiveExercisePerformance.mockResolvedValue({
      previous: new Map(),
      records: new Map([
        [
          11,
          {
            appearanceCount: 1,
            highestRepetitions: {
              achievedAt: '2026-07-20T10:00:00.000Z',
              sessionId: 8,
              value: 10,
            },
            highestSessionVolume: {
              achievedAt: '2026-07-20T10:00:00.000Z',
              sessionId: 8,
              value: 150,
            },
            highestWeight: {
              achievedAt: '2026-07-20T10:00:00.000Z',
              sessionId: 8,
              value: 15,
            },
            lastPerformance: null,
            legacyMatched: false,
          },
        ],
      ]),
    });
    const { getByLabelText, getByText } = await render(<ActiveWorkoutScreen />);

    await waitFor(() =>
      expect(getByLabelText('Dumbbell Curl setini tamamla')).toBeTruthy()
    );
    await fireEvent.press(getByLabelText('Dumbbell Curl setini tamamla'));

    await waitFor(() => expect(getByText(/Yeni ağırlık rekoru/)).toBeTruthy());
    expect(getByText(/Yeni tekrar rekoru/)).toBeTruthy();
    expect(getByText(/Yeni hacim rekoru/)).toBeTruthy();
  });

  it('does not announce a record when the set write fails', async () => {
    mockCompleteSet.mockRejectedValue(new Error('write failed'));
    const { getByLabelText, queryByText } = await render(
      <ActiveWorkoutScreen />
    );

    await waitFor(() =>
      expect(getByLabelText('Dumbbell Curl setini tamamla')).toBeTruthy()
    );
    await fireEvent.press(getByLabelText('Dumbbell Curl setini tamamla'));

    await waitFor(() =>
      expect(queryByText(appStrings.workout.writeError)).toBeTruthy()
    );
    expect(queryByText(/Yeni .* rekoru/)).toBeNull();
  });

  it('shows a Turkish validation message for an incomplete set', async () => {
    const { getByLabelText, getByRole, getByText } = await render(
      <WorkoutExerciseRow
        exercise={{
          ...activeSession.exercises[0]!,
          sets: [
            {
              ...activeSession.exercises[0]!.sets[0]!,
              actualReps: null,
            },
          ],
        }}
        onComplete={jest.fn()}
        onOpenEditor={jest.fn()}
      />
    );

    await fireEvent.changeText(getByLabelText('Dumbbell Curl Tekrar'), '');

    await fireEvent.press(
      getByRole('button', { name: 'Dumbbell Curl setini tamamla' })
    );

    await waitFor(() => {
      expect(getByText(appStrings.workout.invalidSet)).toBeTruthy();
    });
  });

  it('opens the compact editor and preserves completed status while editing', async () => {
    const sessionWithCompletedSet = {
      ...activeSession,
      exercises: [
        {
          ...activeSession.exercises[0]!,
          sets: [
            {
              ...activeSession.exercises[0]!.sets[0]!,
              completedAt: '2026-07-31T10:30:00.000Z',
              isCompleted: true,
            },
            {
              ...activeSession.exercises[0]!.sets[0]!,
              id: 32,
              setNumber: 2,
            },
          ],
        },
      ],
    };
    mockGetSessionDetails.mockResolvedValue(sessionWithCompletedSet);
    const { getByLabelText, getByRole, getByText } = await render(
      <ActiveWorkoutScreen />
    );

    await waitFor(() => {
      expect(getByText('1/2')).toBeTruthy();
    });
    await fireEvent.press(
      getByRole('button', {
        name: `Dumbbell Curl: 1/2. ${appStrings.workout.editSets}`,
      })
    );

    expect(getByText(appStrings.workout.setEditorTitle)).toBeTruthy();
    await fireEvent.changeText(
      getByLabelText('Dumbbell Curl Set 1 Kilo (kg)'),
      '18,5'
    );
    await fireEvent.changeText(
      getByLabelText('Dumbbell Curl Set 1 Tekrar'),
      '10'
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.workout.saveSet })
    );

    await waitFor(() => {
      expect(mockUpdateSetValues).toHaveBeenCalledWith(31, 18.5, 10);
    });
    expect(sessionWithCompletedSet.exercises[0]!.sets[0]!.isCompleted).toBe(
      true
    );
  });

  it('resumes the existing active session without starting another', async () => {
    mockUseWorkoutOverview.mockReturnValue({
      ...baseOverview,
      data: { ...baseOverview.data, activeSession },
    });
    const { getByRole } = await render(<WorkoutScreen />);

    fireEvent.press(
      getByRole('button', { name: appStrings.workout.resumeWorkout })
    );

    expect(mockRouter.push).toHaveBeenCalledWith('/workout/session/9');
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('opens the full history and a recent completed workout', async () => {
    mockUseWorkoutOverview.mockReturnValue({
      ...baseOverview,
      data: {
        ...baseOverview.data,
        recentSessions: [
          {
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
          },
        ],
      },
    });
    const { getByRole } = await render(<WorkoutScreen />);

    await fireEvent.press(
      getByRole('button', { name: appStrings.workout.viewAllHistory })
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/workout/history');

    await fireEvent.press(
      getByRole('button', {
        name: `${appStrings.workout.openWorkoutDetails}: Sırt + Biceps`,
      })
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/workout/history/77');
  });

  it('opens workout program management from the Workout tab', async () => {
    const { getByRole } = await render(<WorkoutScreen />);

    await fireEvent.press(
      getByRole('button', { name: appStrings.workout.editProgram })
    );

    expect(mockRouter.push).toHaveBeenCalledWith('/workout/program');
  });
});
