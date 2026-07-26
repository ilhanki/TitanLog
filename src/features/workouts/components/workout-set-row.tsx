import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { appStrings } from '@/constants/strings';
import type { WorkoutSet } from '@/features/workouts/domain/models';
import {
  formatWorkoutWeight,
  parseRepetitionInput,
  parseWeightInput,
} from '@/features/workouts/utils/workout-values';
import { theme } from '@/theme/tokens';

type WorkoutSetRowProps = {
  disabled: boolean;
  onSave: (weightKg: number, actualReps: number | null) => Promise<void>;
  onToggle: (weightKg: number, actualReps: number) => Promise<void>;
  workoutSet: WorkoutSet;
};

export function WorkoutSetRow({
  disabled,
  onSave,
  onToggle,
  workoutSet,
}: WorkoutSetRowProps) {
  const [weight, setWeight] = useState(
    formatWorkoutWeight(workoutSet.weightKg)
  );
  const [repetitions, setRepetitions] = useState(
    workoutSet.actualReps === null ? '' : String(workoutSet.actualReps)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeight(formatWorkoutWeight(workoutSet.weightKg));
    setRepetitions(
      workoutSet.actualReps === null ? '' : String(workoutSet.actualReps)
    );
  }, [workoutSet.actualReps, workoutSet.weightKg]);

  const parsedValues = () => ({
    repetitions:
      repetitions.trim() === '' ? null : parseRepetitionInput(repetitions),
    weight: parseWeightInput(weight),
  });

  const save = async () => {
    const values = parsedValues();
    if (values.weight === null) {
      setError(appStrings.workout.invalidWeight);
      return;
    }
    if (repetitions.trim() !== '' && values.repetitions === null) {
      setError(appStrings.workout.invalidRepetitions);
      return;
    }
    setError(null);
    await onSave(values.weight, values.repetitions);
  };

  const toggle = async () => {
    if (workoutSet.isCompleted) {
      await onToggle(workoutSet.weightKg, workoutSet.actualReps ?? 0);
      return;
    }
    const values = parsedValues();
    if (
      values.weight === null ||
      values.repetitions === null ||
      values.repetitions <= 0
    ) {
      setError(appStrings.workout.invalidSet);
      return;
    }
    setError(null);
    await onToggle(values.weight, values.repetitions);
  };

  return (
    <View style={styles.container}>
      <AppText variant="bodyStrong">Set {workoutSet.setNumber}</AppText>
      <View style={styles.inputs}>
        <AppTextInput
          editable={!disabled && !workoutSet.isCompleted}
          error={error ?? undefined}
          inputMode="decimal"
          keyboardType="decimal-pad"
          label={appStrings.workout.weightLabel}
          onChangeText={setWeight}
          onEndEditing={() => void save()}
          selectTextOnFocus
          style={styles.input}
          value={weight}
        />
        <AppTextInput
          editable={!disabled && !workoutSet.isCompleted}
          inputMode="numeric"
          keyboardType="number-pad"
          label={appStrings.workout.repetitionLabel}
          onChangeText={setRepetitions}
          onEndEditing={() => void save()}
          placeholder={String(workoutSet.targetReps)}
          selectTextOnFocus
          style={styles.input}
          value={repetitions}
        />
      </View>
      <AppButton
        disabled={disabled}
        label={
          workoutSet.isCompleted
            ? appStrings.workout.markIncomplete
            : appStrings.workout.markComplete
        }
        onPress={() => void toggle()}
        variant={workoutSet.isCompleted ? 'secondary' : 'primary'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopColor: theme.colors.border,
    borderTopWidth: theme.borders.hairline,
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  input: { minWidth: 112 },
  inputs: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
});
