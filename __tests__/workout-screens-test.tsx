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
const mockAddSet = jest.fn();
const mockRemoveSet = jest.fn();
const mockUpdateSetValues = jest.fn();
const mockUseWorkoutOverview = jest.fn();
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
      completeSetAndPrefillNext: jest.fn(),
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

describe('workout screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalParams = { dayId: '1', sessionId: '9' };
    mockUseWorkoutOverview.mockReturnValue(baseOverview);
    mockGetWorkoutDayDetails.mockResolvedValue(workoutDay);
    mockGetActiveSession.mockResolvedValue(null);
    mockGetSessionDetails.mockResolvedValue(activeSession);
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
        getByLabelText('Dumbbell Curl, 3 set, 12 tekrar, 17,5 kg, her el')
      ).toBeTruthy();
    });
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
});
