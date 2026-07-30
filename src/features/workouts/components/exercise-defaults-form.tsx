import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { InlineNumericWheelField } from '@/features/workouts/components/inline-numeric-wheel-field';
import type { WeightMode } from '@/features/workouts/domain/models';
import { parseDefaultSetCount } from '@/features/workouts/utils/workout-program-validation';
import {
  formatWorkoutWeight,
  parseRepetitionInput,
  parseWeightInput,
} from '@/features/workouts/utils/workout-values';
import { theme } from '@/theme/tokens';

export type ExerciseDefaultsFormValues = {
  setCount: string;
  targetReps: string;
  weight: string;
  weightMode: WeightMode;
};

type ExerciseDefaultsFormProps = {
  errors?: Partial<Record<'setCount' | 'targetReps' | 'weight', string>>;
  exerciseName?: string;
  onChange: (values: ExerciseDefaultsFormValues) => void;
  onGestureActiveChange?: (active: boolean) => void;
  values: ExerciseDefaultsFormValues;
};

export function ExerciseDefaultsForm({
  errors,
  exerciseName,
  onChange,
  onGestureActiveChange,
  values,
}: ExerciseDefaultsFormProps) {
  const labelPrefix = exerciseName ? `${exerciseName} ` : '';
  return (
    <View style={styles.container}>
      <View style={styles.numericRow}>
        <View style={styles.numericField}>
          <AppText style={styles.numericLabel} variant="label">
            Set
          </AppText>
          <InlineNumericWheelField
            accessibilityLabel={`${labelPrefix}${appStrings.workout.defaultSets}`}
            formatValue={String}
            inputMode="numeric"
            keyboardType="number-pad"
            max={10}
            min={1}
            onChangeText={(setCount) => onChange({ ...values, setCount })}
            onGestureActiveChange={onGestureActiveChange}
            parseValue={parseDefaultSetCount}
            step={1}
            unit="set"
            value={values.setCount}
          />
          {errors?.setCount ? (
            <AppText accessibilityRole="alert" tone="danger" variant="caption">
              {errors.setCount}
            </AppText>
          ) : null}
        </View>
        <View style={styles.numericField}>
          <AppText style={styles.numericLabel} variant="label">
            Tekrar
          </AppText>
          <InlineNumericWheelField
            accessibilityLabel={`${labelPrefix}${appStrings.workout.defaultRepetitions}`}
            formatValue={String}
            inputMode="numeric"
            keyboardType="number-pad"
            max={100}
            min={1}
            onChangeText={(targetReps) => onChange({ ...values, targetReps })}
            onGestureActiveChange={onGestureActiveChange}
            parseValue={parseRepetitionInput}
            step={1}
            unit="tekrar"
            value={values.targetReps}
          />
          {errors?.targetReps ? (
            <AppText accessibilityRole="alert" tone="danger" variant="caption">
              {errors.targetReps}
            </AppText>
          ) : null}
        </View>
        <View style={styles.numericField}>
          <AppText style={styles.numericLabel} variant="label">
            Kilo
          </AppText>
          <InlineNumericWheelField
            accessibilityLabel={`${labelPrefix}${appStrings.workout.defaultWeight}`}
            formatValue={formatWorkoutWeight}
            inputMode="decimal"
            keyboardType="decimal-pad"
            max={2000}
            min={2.5}
            onChangeText={(weight) => onChange({ ...values, weight })}
            onGestureActiveChange={onGestureActiveChange}
            parseValue={parseWeightInput}
            step={2.5}
            unit="kilogram"
            value={values.weight}
          />
          {errors?.weight ? (
            <AppText accessibilityRole="alert" tone="danger" variant="caption">
              {errors.weight}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.modeGroup}>
        <AppText variant="bodyStrong">{appStrings.workout.weightMode}</AppText>
        <View style={styles.modeRow}>
          {(
            [
              ['total', appStrings.workout.totalWeight],
              ['per_hand', appStrings.workout.perHandWeight],
            ] as const
          ).map(([mode, label]) => {
            const selected = values.weightMode === mode;
            return (
              <Pressable
                accessibilityLabel={`${labelPrefix}${label}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={mode}
                onPress={() => onChange({ ...values, weightMode: mode })}
                style={[
                  styles.modeButton,
                  selected && styles.modeButtonSelected,
                ]}
              >
                <AppText
                  tone={selected ? 'primary' : 'muted'}
                  variant="bodyStrong"
                >
                  {selected ? '✓ ' : ''}
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.md },
  modeButton: {
    alignItems: 'center',
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.layout.compactTouchTarget,
    paddingHorizontal: theme.spacing.sm,
  },
  modeButtonSelected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  modeGroup: { gap: theme.spacing.sm },
  modeRow: { flexDirection: 'row', gap: theme.spacing.sm },
  numericField: { flex: 1, gap: theme.spacing.xs, minWidth: 0 },
  numericLabel: { textAlign: 'center' },
  numericRow: { flexDirection: 'row', gap: theme.spacing.sm },
});
