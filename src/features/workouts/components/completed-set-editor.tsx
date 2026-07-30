import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { InlineNumericWheelField } from '@/features/workouts/components/inline-numeric-wheel-field';
import type {
  WorkoutSessionExercise,
  WorkoutSet,
} from '@/features/workouts/domain/models';
import {
  formatWorkoutWeight,
  parseRepetitionInput,
  parseWeightInput,
} from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type CompletedSetEditorProps = {
  exercise: WorkoutSessionExercise | null;
  onAddSet: () => Promise<void>;
  onClose: () => void;
  onRemoveSet: () => Promise<void>;
  onSaveSet: (
    setId: number,
    weightKg: number,
    actualReps: number
  ) => Promise<void>;
  visible: boolean;
};

type CompletedSetRowProps = {
  disabled: boolean;
  exerciseName: string;
  onGestureActiveChange: (active: boolean) => void;
  onSave: (weightKg: number, actualReps: number) => Promise<void>;
  workoutSet: WorkoutSet;
};

function CompletedSetRow({
  disabled,
  exerciseName,
  onGestureActiveChange,
  onSave,
  workoutSet,
}: CompletedSetRowProps) {
  const [weight, setWeight] = useState(
    formatWorkoutWeight(workoutSet.weightKg)
  );
  const [repetitions, setRepetitions] = useState(
    String(workoutSet.actualReps ?? workoutSet.targetReps)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeight(formatWorkoutWeight(workoutSet.weightKg));
    setRepetitions(String(workoutSet.actualReps ?? workoutSet.targetReps));
    setError(null);
  }, [
    workoutSet.actualReps,
    workoutSet.id,
    workoutSet.targetReps,
    workoutSet.weightKg,
  ]);

  const save = async () => {
    const parsedWeight = parseWeightInput(weight);
    const parsedRepetitions = parseRepetitionInput(repetitions);
    if (parsedWeight === null || parsedRepetitions === null) {
      setError(appStrings.workout.invalidSet);
      return;
    }
    setError(null);
    await onSave(parsedWeight, parsedRepetitions);
  };

  return (
    <View style={styles.setRow}>
      <AppText style={styles.setLabel} variant="bodyStrong">
        Set {workoutSet.setNumber}
      </AppText>
      <InlineNumericWheelField
        accessibilityLabel={`${exerciseName} Set ${workoutSet.setNumber} ${appStrings.workout.weightLabel}`}
        disabled={disabled}
        formatValue={formatWorkoutWeight}
        inputMode="decimal"
        keyboardType="decimal-pad"
        max={2000}
        min={2.5}
        onChangeText={setWeight}
        onGestureActiveChange={onGestureActiveChange}
        parseValue={parseWeightInput}
        step={2.5}
        style={styles.input}
        unit="kilogram"
        value={weight}
      />
      <InlineNumericWheelField
        accessibilityLabel={`${exerciseName} Set ${workoutSet.setNumber} ${appStrings.workout.repetitionLabel}`}
        disabled={disabled}
        formatValue={String}
        inputMode="numeric"
        keyboardType="number-pad"
        max={100}
        min={1}
        onChangeText={setRepetitions}
        onGestureActiveChange={onGestureActiveChange}
        parseValue={parseRepetitionInput}
        step={1}
        style={styles.repetitionInput}
        unit="tekrar"
        value={repetitions}
      />
      <AppButton
        disabled={disabled}
        label={appStrings.workout.saveSet}
        onPress={() => void save()}
        style={styles.saveButton}
        variant="secondary"
      />
      {error ? (
        <AppText
          accessibilityRole="alert"
          style={styles.rowError}
          tone="danger"
          variant="caption"
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function CompletedSetEditor({
  exercise,
  onAddSet,
  onClose,
  onRemoveSet,
  onSaveSet,
  visible,
}: CompletedSetEditorProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const [numericGestureActive, setNumericGestureActive] = useState(false);

  const runAction = async (key: string, action: () => Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingKey(key);
    setError(null);
    try {
      await action();
    } catch {
      setError(appStrings.workout.writeError);
    } finally {
      pendingRef.current = false;
      setPendingKey(null);
    }
  };

  const completedSets = exercise?.sets.filter((set) => set.isCompleted) ?? [];
  const nextSet = exercise?.sets.find((set) => !set.isCompleted) ?? null;
  const finalSet = exercise?.sets.at(-1) ?? null;
  const canRemove = Boolean(
    finalSet && !finalSet.isCompleted && exercise!.sets.length > 1
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText accessibilityRole="header" variant="heading">
                {appStrings.workout.setEditorTitle}
              </AppText>
              <AppText numberOfLines={1} tone="muted">
                {exercise?.name}
              </AppText>
            </View>
            <AppButton
              label={appStrings.workout.closeEditor}
              onPress={onClose}
              style={styles.closeButton}
              variant="ghost"
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!numericGestureActive}
          >
            {completedSets.map((workoutSet) => (
              <CompletedSetRow
                disabled={pendingKey !== null}
                exerciseName={exercise?.name ?? ''}
                key={workoutSet.id}
                onGestureActiveChange={setNumericGestureActive}
                onSave={(weightKg, actualReps) =>
                  runAction(`save-${workoutSet.id}`, () =>
                    onSaveSet(workoutSet.id, weightKg, actualReps)
                  )
                }
                workoutSet={workoutSet}
              />
            ))}

            {nextSet ? (
              <View style={styles.nextRow}>
                <AppText variant="bodyStrong">Set {nextSet.setNumber}</AppText>
                <AppText tone="muted" variant="caption">
                  {formatWorkoutWeight(nextSet.weightKg)} kg ×{' '}
                  {nextSet.actualReps ?? nextSet.targetReps}{' '}
                  {appStrings.workout.repetitions} ·{' '}
                  {appStrings.workout.nextSet}
                </AppText>
              </View>
            ) : null}

            {error ? (
              <AppText
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                selectable
                tone="danger"
              >
                {error}
              </AppText>
            ) : null}

            <View style={styles.actions}>
              <AppButton
                disabled={pendingKey !== null}
                label={appStrings.workout.addSet}
                onPress={() => void runAction('add', onAddSet)}
                style={styles.action}
                variant="secondary"
              />
              <AppButton
                disabled={pendingKey !== null || !canRemove}
                label={appStrings.workout.removeSet}
                onPress={() => void runAction('remove', onRemoveSet)}
                style={styles.action}
                variant="danger"
              />
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1 },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  closeButton: { minHeight: theme.layout.compactTouchTarget },
  content: { gap: theme.spacing.md, padding: theme.spacing.md },
  header: {
    alignItems: 'center',
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.thin,
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  headerCopy: { flex: 1, gap: theme.spacing.xs },
  input: {
    width: 64,
  },
  modal: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.lg,
    borderWidth: theme.borders.thin,
    maxHeight: '88%',
    maxWidth: 560,
    overflow: 'hidden',
    width: '94%',
  },
  nextRow: {
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    flex: 1,
    justifyContent: 'center',
  },
  repetitionInput: {
    width: 52,
  },
  rowError: { flexBasis: '100%' },
  saveButton: { minHeight: theme.layout.compactTouchTarget },
  setLabel: { width: 48 },
  setRow: {
    alignItems: 'center',
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
});
