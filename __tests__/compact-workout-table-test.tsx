import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { appStrings } from '@/constants/strings';
import { CompletedSetEditor } from '@/features/workouts/components/completed-set-editor';
import { WorkoutExerciseRow } from '@/features/workouts/components/workout-exercise-row';
import type {
  WorkoutSessionExercise,
  WorkoutSet,
} from '@/features/workouts/domain/models';
import type { ExerciseAppearance } from '@/features/workouts/domain/exercise-performance';

function createSet(
  id: number,
  setNumber: number,
  overrides: Partial<WorkoutSet> = {}
): WorkoutSet {
  return {
    actualReps: 12,
    completedAt: null,
    id,
    isCompleted: false,
    setNumber,
    targetReps: 12,
    weightKg: 50,
    ...overrides,
  };
}

function createExercise(
  id: number,
  name: string,
  overrides: Partial<WorkoutSessionExercise> = {}
): WorkoutSessionExercise {
  return {
    exerciseId: id,
    id,
    muscleGroup: 'Back',
    name,
    sets: [
      createSet(id * 10 + 1, 1),
      createSet(id * 10 + 2, 2),
      createSet(id * 10 + 3, 3),
    ],
    sortOrder: id,
    weightMode: 'total',
    ...overrides,
  };
}

function createPreviousAppearance(
  overrides: Partial<ExerciseAppearance> = {}
): ExerciseAppearance {
  return {
    completedAt: '2026-07-30T10:30:00.000Z',
    completedSetCount: 2,
    exerciseId: 1,
    highestWeightKg: 55,
    legacyMatched: false,
    sessionExerciseId: 91,
    sessionId: 9,
    sets: [
      { actualReps: 12, setNumber: 1, weightKg: 50 },
      { actualReps: 10, setNumber: 2, weightKg: 55 },
    ],
    totalRepetitions: 22,
    totalVolume: 1150,
    weightMode: 'total',
    workoutName: 'Sırt + Biceps',
    ...overrides,
  };
}

function StatefulExerciseRow({
  exercise,
}: {
  exercise: WorkoutSessionExercise;
}) {
  const [current, setCurrent] = useState(exercise);
  return (
    <WorkoutExerciseRow
      exercise={current}
      onComplete={async (setId, weightKg, actualReps) => {
        setCurrent((previous) => {
          const completedIndex = previous.sets.findIndex(
            (set) => set.id === setId
          );
          return {
            ...previous,
            sets: previous.sets.map((set, index) =>
              index === completedIndex
                ? {
                    ...set,
                    actualReps,
                    completedAt: '2026-08-01T10:00:00.000Z',
                    isCompleted: true,
                    weightKg,
                  }
                : index === completedIndex + 1
                  ? { ...set, actualReps, weightKg }
                  : set
            ),
          };
        });
      }}
      onOpenEditor={jest.fn()}
    />
  );
}

describe('compact workout table', () => {
  it('shows previous performance and opens history without changing the draft', async () => {
    const onOpenHistory = jest.fn();
    const { getByLabelText, getByRole, getByText, queryByTestId } =
      await render(
        <WorkoutExerciseRow
          exercise={createExercise(1, 'Lat Pulldown')}
          onComplete={jest.fn()}
          onOpenEditor={jest.fn()}
          onOpenHistory={onOpenHistory}
          previousPerformance={createPreviousAppearance()}
        />
      );

    expect(getByText('Geçen: en yüksek 55 kg · 2 set')).toBeTruthy();
    expect(
      getByLabelText('Geçen antrenman: 50×12 · 55×10. Toplam 2 set.')
    ).toBeTruthy();
    await fireEvent.press(
      getByRole('button', { name: 'Lat Pulldown geçmişini aç' })
    );
    expect(onOpenHistory).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(
      getByLabelText('Lat Pulldown Kilo (kg)'),
      '52,5'
    );
    expect(getByText('Geçen: en yüksek 55 kg · 2 set')).toBeTruthy();
    expect(queryByTestId('weight-wheel-modal')).toBeNull();
    expect(getByLabelText('Lat Pulldown Kilo (kg)')).toHaveProp(
      'value',
      '52,5'
    );
  });

  it('keeps inputs usable while prior performance is loading or unavailable', async () => {
    const exercise = createExercise(1, 'Lat Pulldown');
    const { getByLabelText, getByText, rerender } = await render(
      <WorkoutExerciseRow
        exercise={exercise}
        onComplete={jest.fn()}
        onOpenEditor={jest.fn()}
        previousPerformanceLoading
      />
    );

    expect(getByText('Geçmiş yükleniyor')).toBeTruthy();
    expect(getByLabelText('Lat Pulldown Tekrar')).toHaveProp('editable', true);
    await rerender(
      <WorkoutExerciseRow
        exercise={exercise}
        onComplete={jest.fn()}
        onOpenEditor={jest.fn()}
        previousPerformanceError
      />
    );
    expect(
      getByText(appStrings.workout.previousPerformanceUnavailable)
    ).toBeTruthy();
    expect(getByLabelText('Lat Pulldown Kilo (kg)')).toHaveProp(
      'editable',
      true
    );
  });
  it('renders every exercise simultaneously as one editable row', async () => {
    const exercises = [
      createExercise(1, 'Lat Pulldown'),
      createExercise(2, 'Low Row'),
      createExercise(3, 'Seated Row'),
    ];
    const { getByLabelText, getByText, toJSON } = await render(
      <View>
        {exercises.map((exercise) => (
          <WorkoutExerciseRow
            exercise={exercise}
            key={exercise.id}
            onComplete={jest.fn()}
            onOpenEditor={jest.fn()}
          />
        ))}
      </View>
    );

    for (const exercise of exercises) {
      expect(getByText(exercise.name)).toBeTruthy();
      expect(
        getByLabelText(`${exercise.name} ${appStrings.workout.weightLabel}`)
      ).toHaveProp('value', '50');
      expect(
        getByLabelText(`${exercise.name} ${appStrings.workout.repetitionLabel}`)
      ).toHaveProp('value', '12');
      expect(getByLabelText(`${exercise.name} setini tamamla`)).toBeTruthy();
    }
    expect(JSON.stringify(toJSON())).not.toContain('"horizontal":true');
  });

  it('uses target repetitions when persisted actual repetitions are absent', async () => {
    const exercise = createExercise(1, 'Lat Pulldown', {
      sets: [createSet(11, 1, { actualReps: null, targetReps: 12 })],
    });
    const { getByLabelText } = await render(
      <WorkoutExerciseRow
        exercise={exercise}
        onComplete={jest.fn()}
        onOpenEditor={jest.fn()}
      />
    );

    expect(getByLabelText('Lat Pulldown Tekrar')).toHaveProp('value', '12');
    expect(getByLabelText('Lat Pulldown Kilo (kg)')).toHaveProp('value', '50');
  });

  it('updates only the active row draft through inline wheel actions', async () => {
    const exercise = createExercise(1, 'Lat Pulldown');
    const onComplete = jest.fn();
    const { getByLabelText, queryByTestId } = await render(
      <WorkoutExerciseRow
        exercise={exercise}
        onComplete={onComplete}
        onOpenEditor={jest.fn()}
      />
    );
    await fireEvent(
      getByLabelText('Lat Pulldown Kilo (kg)'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'increment' },
      }
    );

    expect(getByLabelText('Lat Pulldown Kilo (kg)')).toHaveProp(
      'value',
      '52,5'
    );
    expect(queryByTestId('weight-wheel-modal')).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('preserves an older active session target repetition value', async () => {
    const exercise = createExercise(1, 'Lat Pulldown', {
      sets: [createSet(11, 1, { actualReps: null, targetReps: 10 })],
    });
    const { getByLabelText } = await render(
      <WorkoutExerciseRow
        exercise={exercise}
        onComplete={jest.fn()}
        onOpenEditor={jest.fn()}
      />
    );

    expect(getByLabelText('Lat Pulldown Tekrar')).toHaveProp('value', '10');
  });

  it('prefers persisted actual repetitions and preserves an edited draft', async () => {
    const exercise = createExercise(1, 'Lat Pulldown', {
      sets: [createSet(11, 1, { actualReps: 8, targetReps: 12 })],
    });
    const onComplete = jest.fn();
    const onOpenEditor = jest.fn();
    const { getByLabelText, rerender } = await render(
      <WorkoutExerciseRow
        exercise={exercise}
        onComplete={onComplete}
        onOpenEditor={onOpenEditor}
      />
    );
    const repetitionInput = getByLabelText('Lat Pulldown Tekrar');

    expect(repetitionInput).toHaveProp('value', '8');
    expect(repetitionInput).toHaveProp('editable', true);
    await fireEvent.changeText(repetitionInput, '9');
    await rerender(
      <WorkoutExerciseRow
        exercise={{ ...exercise }}
        onComplete={onComplete}
        onOpenEditor={onOpenEditor}
      />
    );

    expect(getByLabelText('Lat Pulldown Tekrar')).toHaveProp('value', '9');
  });

  it('falls back to twelve only when no persisted repetition exists', async () => {
    const exercise = createExercise(1, 'Lat Pulldown', {
      sets: [
        createSet(11, 1, {
          actualReps: null,
          targetReps: undefined as unknown as number,
        }),
      ],
    });
    const { getByLabelText } = await render(
      <WorkoutExerciseRow
        exercise={exercise}
        onComplete={jest.fn()}
        onOpenEditor={jest.fn()}
      />
    );

    expect(getByLabelText('Lat Pulldown Tekrar')).toHaveProp('value', '12');
  });

  it('advances the same row and inherits values after completion', async () => {
    const { getByLabelText, getByText } = await render(
      <StatefulExerciseRow exercise={createExercise(1, 'Lat Pulldown')} />
    );

    await fireEvent.changeText(
      getByLabelText('Lat Pulldown Kilo (kg)'),
      '52,5'
    );
    await fireEvent.changeText(getByLabelText('Lat Pulldown Tekrar'), '10');
    await fireEvent.press(getByLabelText('Lat Pulldown setini tamamla'));

    await waitFor(() => expect(getByText('1/3')).toBeTruthy());
    expect(getByText('Lat Pulldown')).toBeTruthy();
    expect(getByLabelText('Lat Pulldown Kilo (kg)')).toHaveProp(
      'value',
      '52,5'
    );
    expect(getByLabelText('Lat Pulldown Tekrar')).toHaveProp('value', '10');
  });

  it('keeps a fully completed exercise visible in the same row', async () => {
    const { getByLabelText, getByText } = await render(
      <StatefulExerciseRow exercise={createExercise(1, 'Lat Pulldown')} />
    );

    for (let completed = 1; completed <= 3; completed++) {
      await fireEvent.press(getByLabelText('Lat Pulldown setini tamamla'));
      await waitFor(() => expect(getByText(`${completed}/3`)).toBeTruthy());
    }

    expect(getByText('Lat Pulldown')).toBeTruthy();
    expect(
      getByLabelText(`Lat Pulldown: ${appStrings.workout.completedExercise}`)
    ).toBeDisabled();
  });

  it('locks only the affected row and ignores rapid repeated completion', async () => {
    let resolveFirst!: () => void;
    const pendingCompletion = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const firstComplete = jest.fn(() => pendingCompletion);
    const secondComplete = jest.fn().mockResolvedValue(undefined);
    const { getByLabelText } = await render(
      <View>
        <WorkoutExerciseRow
          exercise={createExercise(1, 'Lat Pulldown')}
          onComplete={firstComplete}
          onOpenEditor={jest.fn()}
        />
        <WorkoutExerciseRow
          exercise={createExercise(2, 'Low Row')}
          onComplete={secondComplete}
          onOpenEditor={jest.fn()}
        />
      </View>
    );

    await fireEvent.press(getByLabelText('Lat Pulldown setini tamamla'));
    await fireEvent.press(getByLabelText('Lat Pulldown setini tamamla'));

    expect(firstComplete).toHaveBeenCalledTimes(1);
    expect(getByLabelText('Low Row setini tamamla')).not.toBeDisabled();
    resolveFirst();
    await waitFor(() =>
      expect(getByLabelText('Lat Pulldown setini tamamla')).not.toBeDisabled()
    );
  });

  it('allows exercises to be completed in any order', async () => {
    const { getAllByText, getByLabelText, getByText } = await render(
      <View>
        <StatefulExerciseRow exercise={createExercise(1, 'Lat Pulldown')} />
        <StatefulExerciseRow exercise={createExercise(2, 'Low Row')} />
      </View>
    );

    await fireEvent.press(getByLabelText('Low Row setini tamamla'));
    await waitFor(() => expect(getByText('1/3')).toBeTruthy());
    expect(getByText('0/3')).toBeTruthy();

    await fireEvent.press(getByLabelText('Lat Pulldown setini tamamla'));
    await waitFor(() => expect(getAllByText('1/3')).toHaveLength(2));
  });

  it('opens a flat editor with completed, add, and safe-remove actions', async () => {
    const exercise = createExercise(1, 'Lat Pulldown', {
      sets: [
        createSet(11, 1, {
          completedAt: '2026-08-01T10:00:00.000Z',
          isCompleted: true,
        }),
        createSet(12, 2),
      ],
    });
    const onAddSet = jest.fn().mockResolvedValue(undefined);
    const onRemoveSet = jest.fn().mockResolvedValue(undefined);
    const { getByLabelText, getByRole, getByText, queryByTestId } =
      await render(
        <CompletedSetEditor
          exercise={exercise}
          onAddSet={onAddSet}
          onClose={jest.fn()}
          onRemoveSet={onRemoveSet}
          onSaveSet={jest.fn()}
          visible
        />
      );

    expect(getByText('Set 1')).toBeTruthy();
    expect(getByText(/Set 2/)).toBeTruthy();
    await fireEvent(
      getByLabelText('Lat Pulldown Set 1 Kilo (kg)'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    );
    expect(getByLabelText('Lat Pulldown Set 1 Kilo (kg)')).toHaveProp(
      'value',
      '52,5'
    );
    expect(queryByTestId('weight-wheel-modal')).toBeNull();
    await fireEvent.press(
      getByRole('button', { name: appStrings.workout.addSet })
    );
    await waitFor(() => expect(onAddSet).toHaveBeenCalledTimes(1));
    await fireEvent.press(
      getByRole('button', { name: appStrings.workout.removeSet })
    );
    await waitFor(() => expect(onRemoveSet).toHaveBeenCalledTimes(1));
  });

  it('ignores rapid repeated add-set presses', async () => {
    let resolveAdd!: () => void;
    const pendingAdd = new Promise<void>((resolve) => {
      resolveAdd = resolve;
    });
    const onAddSet = jest.fn(() => pendingAdd);
    const { getByRole } = await render(
      <CompletedSetEditor
        exercise={createExercise(1, 'Lat Pulldown')}
        onAddSet={onAddSet}
        onClose={jest.fn()}
        onRemoveSet={jest.fn()}
        onSaveSet={jest.fn()}
        visible
      />
    );
    const addButton = getByRole('button', {
      name: appStrings.workout.addSet,
    });

    await fireEvent.press(addButton);
    await fireEvent.press(addButton);

    expect(onAddSet).toHaveBeenCalledTimes(1);
    resolveAdd();
    await waitFor(() => expect(addButton).not.toBeDisabled());
  });
});
