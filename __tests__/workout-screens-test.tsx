import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import { WorkoutSetRow } from '@/features/workouts/components/workout-set-row';
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
          actualReps: null,
          completedAt: null,
          id: 31,
          isCompleted: false,
          setNumber: 1,
          targetReps: 10,
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
      addSet: jest.fn(),
      cancelSession: jest.fn(),
      completeSession: jest.fn(),
      getActiveSession: mockGetActiveSession,
      getSessionDetails: mockGetSessionDetails,
      removeLastIncompleteSet: jest.fn(),
      startSessionFromWorkoutDay: mockStartSession,
      toggleSetCompletion: jest.fn(),
      updateSetValues: jest.fn(),
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
    const { getByText } = await render(<WorkoutDayScreen />);

    await waitFor(() => {
      expect(getByText('Dumbbell Curl')).toBeTruthy();
      expect(getByText('12 tk · el')).toBeTruthy();
    });
  });

  it('renders active-session set inputs', async () => {
    const { getByLabelText } = await render(<ActiveWorkoutScreen />);

    await waitFor(() => {
      expect(getByLabelText(appStrings.workout.weightLabel)).toBeTruthy();
      expect(getByLabelText(appStrings.workout.repetitionLabel)).toBeTruthy();
    });
  });

  it('shows a Turkish validation message for an incomplete set', async () => {
    const { getByRole, getByText } = await render(
      <WorkoutSetRow
        disabled={false}
        onSave={jest.fn()}
        onToggle={jest.fn()}
        workoutSet={activeSession.exercises[0]!.sets[0]!}
      />
    );

    fireEvent.press(
      getByRole('button', { name: appStrings.workout.markComplete })
    );

    await waitFor(() => {
      expect(getByText(appStrings.workout.invalidSet)).toBeTruthy();
    });
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
