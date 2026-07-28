import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { appStrings } from '@/constants/strings';
import type { WeightMode } from '@/features/workouts/domain/models';
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
  values: ExerciseDefaultsFormValues;
};

export function ExerciseDefaultsForm({
  errors,
  exerciseName,
  onChange,
  values,
}: ExerciseDefaultsFormProps) {
  const labelPrefix = exerciseName ? `${exerciseName} ` : '';
  return (
    <View style={styles.container}>
      <View style={styles.numericRow}>
        <View style={styles.numericField}>
          <AppTextInput
            accessibilityLabel={`${labelPrefix}${appStrings.workout.defaultSets}`}
            error={errors?.setCount}
            inputMode="numeric"
            label={appStrings.workout.defaultSets}
            onChangeText={(setCount) => onChange({ ...values, setCount })}
            value={values.setCount}
          />
        </View>
        <View style={styles.numericField}>
          <AppTextInput
            accessibilityLabel={`${labelPrefix}${appStrings.workout.defaultRepetitions}`}
            error={errors?.targetReps}
            inputMode="numeric"
            label={appStrings.workout.defaultRepetitions}
            onChangeText={(targetReps) => onChange({ ...values, targetReps })}
            value={values.targetReps}
          />
        </View>
      </View>
      <AppTextInput
        accessibilityLabel={`${labelPrefix}${appStrings.workout.defaultWeight}`}
        error={errors?.weight}
        inputMode="decimal"
        label={appStrings.workout.defaultWeight}
        onChangeText={(weight) => onChange({ ...values, weight })}
        value={values.weight}
      />
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
  container: { gap: theme.spacing.lg },
  modeButton: {
    alignItems: 'center',
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.layout.touchTarget,
    paddingHorizontal: theme.spacing.sm,
  },
  modeButtonSelected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  modeGroup: { gap: theme.spacing.sm },
  modeRow: { flexDirection: 'row', gap: theme.spacing.sm },
  numericField: { flex: 1 },
  numericRow: { flexDirection: 'row', gap: theme.spacing.md },
});
