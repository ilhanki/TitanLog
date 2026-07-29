import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { appStrings } from '@/constants/strings';
import { WorkoutProgramError } from '@/features/workouts/data/workout-program-repository';
import { AddWorkoutExerciseScreen } from '@/features/workouts/screens/add-workout-exercise-screen';
import { CustomWorkoutExerciseScreen } from '@/features/workouts/screens/custom-workout-exercise-screen';
import { WorkoutProgramDayScreen } from '@/features/workouts/screens/workout-program-day-screen';
import { WorkoutProgramScreen } from '@/features/workouts/screens/workout-program-screen';

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
};
const mockDatabase = {};
const mockGetActivePlan = jest.fn();
const mockGetWorkoutDayDetails = jest.fn();
const mockGetActiveSession = jest.fn();
const mockUpdateWorkoutDay = jest.fn();
const mockUpdateExerciseDefaults = jest.fn();
const mockReorderExercise = jest.fn();
const mockRemoveExerciseFromDay = jest.fn();
const mockGetAvailableExercises = jest.fn();
const mockAddExistingExercise = jest.fn();
const mockCreateCustomExerciseAndAdd = jest.fn();
const mockNavigationListeners = new Map<string, (event: never) => void>();
const mockNavigation = {
  addListener: jest.fn((name: string, callback: (event: never) => void) => {
    mockNavigationListeners.set(name, callback);
    return jest.fn();
  }),
  dispatch: jest.fn(),
};
let mockLocalParams = { dayId: '1' };

const workoutDay = {
  exerciseCount: 2,
  exercisePreview: ['Lat Pulldown', 'Dumbbell Curl'],
  exercises: [
    {
      equipment: 'Cable machine',
      id: 11,
      muscleGroup: 'Sırt',
      name: 'Lat Pulldown',
      setCount: 3,
      sortOrder: 1,
      targetReps: 12,
      weightKg: 50,
      weightMode: 'total' as const,
    },
    {
      equipment: 'Dumbbell',
      id: 12,
      muscleGroup: 'Biceps',
      name: 'Dumbbell Curl',
      setCount: 3,
      sortOrder: 2,
      targetReps: 12,
      weightKg: 17.5,
      weightMode: 'per_hand' as const,
    },
  ],
  id: 1,
  name: 'Sırt + Biceps',
  scheduleWeekdays: [1, 4],
  sortOrder: 1,
  subtitle: 'Sırt ve kol çekiş kasları',
  totalSetCount: 6,
};

const plan = {
  days: [workoutDay],
  description: 'Başlangıç programı',
  id: 1,
  name: 'Titan Başlangıç Programı',
};

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
    useLocalSearchParams: () => mockLocalParams,
    useNavigation: () => mockNavigation,
    useRouter: () => mockRouter,
  };
});

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDatabase,
}));

jest.mock('@/features/workouts/data/workout-plan-repository', () => ({
  createWorkoutPlanRepository: () => ({
    getActivePlan: mockGetActivePlan,
    getWorkoutDayDetails: mockGetWorkoutDayDetails,
  }),
}));

jest.mock('@/features/workouts/data/workout-session-repository', () => ({
  createWorkoutSessionRepository: () => ({
    getActiveSession: mockGetActiveSession,
  }),
}));

jest.mock('@/features/workouts/data/workout-program-repository', () => {
  class MockProgramError extends Error {
    readonly code: string;
    readonly details?: { dayName?: string; weekday?: number };

    constructor(
      mockCode: string,
      mockDetails?: { dayName?: string; weekday?: number }
    ) {
      super(mockCode);
      this.code = mockCode;
      this.details = mockDetails;
    }
  }
  return {
    WorkoutProgramError: MockProgramError,
    createWorkoutProgramRepository: () => ({
      addExistingExercise: mockAddExistingExercise,
      createCustomExerciseAndAdd: mockCreateCustomExerciseAndAdd,
      getAvailableExercises: mockGetAvailableExercises,
      removeExerciseFromDay: mockRemoveExerciseFromDay,
      reorderExercise: mockReorderExercise,
      updateExerciseDefaults: mockUpdateExerciseDefaults,
      updateWorkoutDay: mockUpdateWorkoutDay,
    }),
  };
});

describe('workout program screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationListeners.clear();
    mockLocalParams = { dayId: '1' };
    mockGetActivePlan.mockResolvedValue(plan);
    mockGetWorkoutDayDetails.mockResolvedValue(workoutDay);
    mockGetActiveSession.mockResolvedValue(null);
    mockUpdateWorkoutDay.mockResolvedValue(undefined);
    mockUpdateExerciseDefaults.mockResolvedValue(undefined);
    mockReorderExercise.mockResolvedValue(undefined);
    mockRemoveExerciseFromDay.mockResolvedValue(1);
    mockGetAvailableExercises.mockResolvedValue([
      {
        equipment: 'Machine',
        id: 21,
        muscleGroup: 'Bacak',
        name: 'Leg Press',
      },
    ]);
    mockAddExistingExercise.mockResolvedValue(undefined);
    mockCreateCustomExerciseAndAdd.mockResolvedValue(30);
  });

  it('renders active plan days and opens the day editor', async () => {
    const { getByRole, getByText } = await render(<WorkoutProgramScreen />);
    await waitFor(() =>
      expect(getByText('Titan Başlangıç Programı')).toBeTruthy()
    );
    await fireEvent.press(
      getByRole('button', {
        name: /Sırt \+ Biceps/,
      })
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/workout/program/day/1');
  });

  it('shows an invalid workout-day state without querying the repository', async () => {
    mockLocalParams = { dayId: 'invalid' };
    const { getByText } = await render(<WorkoutProgramDayScreen />);
    await waitFor(() =>
      expect(getByText(appStrings.workout.dayNotFound)).toBeTruthy()
    );
    expect(mockGetWorkoutDayDetails).not.toHaveBeenCalled();
  });

  it('prefills day metadata, weekdays, exercise defaults, and active notice', async () => {
    mockGetActiveSession.mockResolvedValue({
      id: 9,
      workoutDayId: 1,
    });
    const { getByLabelText, getByText, toJSON } = await render(
      <WorkoutProgramDayScreen />
    );
    await waitFor(() =>
      expect(getByLabelText(appStrings.workout.dayName)).toHaveProp(
        'value',
        'Sırt + Biceps'
      )
    );
    expect(getByLabelText('Pazartesi')).toHaveProp('accessibilityState', {
      checked: true,
    });
    expect(getByText(appStrings.workout.changesNextWorkout)).toBeTruthy();
    expect(getByText(/17,5 kg/)).toBeTruthy();
    expect(JSON.stringify(toJSON())).not.toContain('"horizontal":true');
  });

  it('shows a truthful occupied-weekday conflict on save', async () => {
    mockUpdateWorkoutDay.mockRejectedValue(
      new WorkoutProgramError('schedule_conflict', {
        dayName: 'Göğüs + Triceps',
        weekday: 2,
      })
    );
    const { getByLabelText, getByRole, getByText } = await render(
      <WorkoutProgramDayScreen />
    );
    await waitFor(() => expect(getByLabelText('Salı')).toBeTruthy());
    await fireEvent.press(getByLabelText('Salı'));
    await fireEvent.press(
      getByRole('button', { name: appStrings.workout.saveDay })
    );
    await waitFor(() =>
      expect(getByText('Salı, Göğüs + Triceps gününe atanmış.')).toBeTruthy()
    );
  });

  it('updates exercise defaults and invokes explicit reorder controls', async () => {
    const { getByLabelText, getByRole } = await render(
      <WorkoutProgramDayScreen />
    );
    await waitFor(() =>
      expect(
        getByRole('button', {
          name: `Lat Pulldown: ${appStrings.workout.editDefaults}`,
        })
      ).toBeTruthy()
    );
    await fireEvent.press(
      getByRole('button', {
        name: `Lat Pulldown: ${appStrings.workout.editDefaults}`,
      })
    );
    await fireEvent.changeText(
      getByLabelText(`Lat Pulldown ${appStrings.workout.defaultWeight}`),
      '55,5'
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.workout.saveDefaults })
    );
    await waitFor(() =>
      expect(mockUpdateExerciseDefaults).toHaveBeenCalledWith(
        1,
        11,
        expect.objectContaining({ weightKg: 55.5 })
      )
    );
    await fireEvent.press(
      getByRole('button', {
        name: `Dumbbell Curl: ${appStrings.workout.moveUp}`,
      })
    );
    await waitFor(() =>
      expect(mockReorderExercise).toHaveBeenCalledWith(1, 12, 'up')
    );
  });

  it('requires a stronger native confirmation for the final exercise', async () => {
    jest.spyOn(Alert, 'alert');
    mockGetWorkoutDayDetails.mockResolvedValue({
      ...workoutDay,
      exerciseCount: 1,
      exercises: [workoutDay.exercises[0]],
    });
    const { getByRole } = await render(<WorkoutProgramDayScreen />);
    await waitFor(() =>
      expect(
        getByRole('button', {
          name: `Lat Pulldown: ${appStrings.workout.removeFromDay}`,
        })
      ).toBeTruthy()
    );
    await fireEvent.press(
      getByRole('button', {
        name: `Lat Pulldown: ${appStrings.workout.removeFromDay}`,
      })
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      appStrings.workout.removeFinalExerciseTitle,
      appStrings.workout.removeFinalExerciseDescription,
      expect.any(Array)
    );
  });

  it('searches existing exercises, shows empty results, and configures a selection', async () => {
    const { getAllByText, getByLabelText, getByRole, getByText, rerender } =
      await render(<AddWorkoutExerciseScreen />);
    await waitFor(() => expect(getByText('Leg Press')).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: /Leg Press/ }));
    expect(getByText(appStrings.workout.configureExercise)).toBeTruthy();

    await fireEvent.press(
      getByRole('button', { name: appStrings.common.goBack })
    );
    mockGetAvailableExercises.mockResolvedValue([]);
    await fireEvent.changeText(
      getByLabelText(appStrings.workout.searchExercise),
      'olmayan'
    );
    await rerender(<AddWorkoutExerciseScreen />);
    await waitFor(() =>
      expect(getAllByText(appStrings.workout.noSearchResults)).toHaveLength(2)
    );
  });

  it('validates and atomically submits a custom exercise draft', async () => {
    const { getByLabelText, getByRole, getByText } = await render(
      <CustomWorkoutExerciseScreen />
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.workout.createExercise })
    );
    await waitFor(() =>
      expect(getByText(appStrings.workout.invalidExerciseName)).toBeTruthy()
    );
    await fireEvent.changeText(
      getByLabelText(appStrings.workout.exerciseName),
      'Cable Lateral Raise'
    );
    await fireEvent.changeText(
      getByLabelText(appStrings.workout.muscleGroup),
      'Omuz'
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.workout.createExercise })
    );
    await waitFor(() =>
      expect(mockCreateCustomExerciseAndAdd).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          muscleGroup: 'Omuz',
          name: 'Cable Lateral Raise',
        })
      )
    );
  });

  it('handles invalid add and custom route IDs truthfully', async () => {
    mockLocalParams = { dayId: 'invalid' };

    const addScreen = await render(<AddWorkoutExerciseScreen />);
    await waitFor(() =>
      expect(addScreen.getByText(appStrings.workout.dayNotFound)).toBeTruthy()
    );

    const customScreen = await render(<CustomWorkoutExerciseScreen />);
    await waitFor(() =>
      expect(
        customScreen.getByText(appStrings.workout.dayNotFound)
      ).toBeTruthy()
    );
    expect(mockCreateCustomExerciseAndAdd).not.toHaveBeenCalled();
  });

  it('ignores rapid repeated custom-exercise submissions', async () => {
    let finishSave: ((value: number) => void) | undefined;
    mockCreateCustomExerciseAndAdd.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          finishSave = resolve;
        })
    );
    const { getByLabelText, getByRole } = await render(
      <CustomWorkoutExerciseScreen />
    );
    await fireEvent.changeText(
      getByLabelText(appStrings.workout.exerciseName),
      'Cable Lateral Raise'
    );
    const button = getByRole('button', {
      name: appStrings.workout.createExercise,
    });

    await fireEvent.press(button);
    await fireEvent.press(button);

    expect(mockCreateCustomExerciseAndAdd).toHaveBeenCalledTimes(1);
    finishSave?.(30);
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('guards unsaved day edits with a native discard confirmation', async () => {
    jest.spyOn(Alert, 'alert');
    const { getByLabelText } = await render(<WorkoutProgramDayScreen />);
    await waitFor(() =>
      expect(getByLabelText(appStrings.workout.dayName)).toBeTruthy()
    );
    await fireEvent.changeText(
      getByLabelText(appStrings.workout.dayName),
      'Yeni Gün'
    );
    const event = {
      data: { action: { type: 'GO_BACK' } },
      preventDefault: jest.fn(),
    };
    await waitFor(() =>
      expect(mockNavigationListeners.get('beforeRemove')).toBeDefined()
    );
    mockNavigationListeners.get('beforeRemove')?.(event as never);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      appStrings.workout.discardTitle,
      appStrings.workout.discardDescription,
      expect.any(Array)
    );
  });
});
