import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { InlineNumericWheelField } from '@/features/workouts/components/inline-numeric-wheel-field';
import type { WorkoutSessionExercise } from '@/features/workouts/domain/models';
import type { ExerciseAppearance } from '@/features/workouts/domain/exercise-performance';
import { formatPreviousPerformance } from '@/features/workouts/utils/exercise-performance';
import {
  formatWorkoutWeight,
  parseRepetitionInput,
  parseWeightInput,
} from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type WorkoutExerciseRowProps = {
  exercise: WorkoutSessionExercise;
  onComplete: (
    setId: number,
    weightKg: number,
    actualReps: number
  ) => Promise<void>;
  onOpenEditor: () => void;
  onOpenHistory?: () => void;
  previousPerformance?: ExerciseAppearance | null;
  previousPerformanceError?: boolean;
  previousPerformanceLoading?: boolean;
};

export function WorkoutExerciseRow({
  exercise,
  onComplete,
  onOpenEditor,
  onOpenHistory,
  previousPerformance = null,
  previousPerformanceError = false,
  previousPerformanceLoading = false,
}: WorkoutExerciseRowProps) {
  const completedCount = exercise.sets.filter((set) => set.isCompleted).length;
  const nextSet = exercise.sets.find((set) => !set.isCompleted) ?? null;
  const finalSet = exercise.sets.at(-1) ?? null;
  const displayedSet = nextSet ?? finalSet;
  const displayedRepetitions = displayedSet
    ? (displayedSet.actualReps ?? displayedSet.targetReps ?? 12)
    : null;
  const displayedSetId = displayedSet?.id ?? null;
  const displayedWeightKg = displayedSet?.weightKg ?? null;
  const [weight, setWeight] = useState(
    displayedSet ? formatWorkoutWeight(displayedSet.weightKg) : ''
  );
  const [repetitions, setRepetitions] = useState(
    displayedRepetitions === null ? '' : String(displayedRepetitions)
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const complete = completedCount === exercise.sets.length;
  const previousSummary = formatPreviousPerformance(previousPerformance);

  useEffect(() => {
    setWeight(
      displayedWeightKg === null ? '' : formatWorkoutWeight(displayedWeightKg)
    );
    setRepetitions(
      displayedRepetitions === null ? '' : String(displayedRepetitions)
    );
    setError(null);
  }, [displayedRepetitions, displayedSetId, displayedWeightKg]);

  const submit = async () => {
    if (!nextSet || pendingRef.current) return;
    const parsedWeight = parseWeightInput(weight);
    const parsedRepetitions = parseRepetitionInput(repetitions);
    if (parsedWeight === null || parsedRepetitions === null) {
      setError(appStrings.workout.invalidSet);
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onComplete(nextSet.id, parsedWeight, parsedRepetitions);
      AccessibilityInfo.announceForAccessibility(
        `${exercise.name}: ${appStrings.workout.setCompletedAnnouncement}`
      );
    } catch {
      setError(appStrings.workout.writeError);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const counter = `${completedCount}/${exercise.sets.length}`;
  const completedLabel = complete
    ? `${counter} ${appStrings.workout.completedExercise}`
    : counter;

  return (
    <View
      accessibilityLabel={`${exercise.name}, ${completedLabel}${exercise.weightMode === 'per_hand' ? `, ${appStrings.workout.perHand}` : ''}`}
      style={[styles.row, complete && styles.completedRow]}
    >
      <Pressable
        accessibilityHint={previousSummary.accessibility}
        accessibilityLabel={`${exercise.name} geçmişini aç`}
        accessibilityRole="button"
        disabled={!onOpenHistory}
        onPress={onOpenHistory}
        style={styles.nameCell}
      >
        <AppText
          accessibilityLabel={exercise.name}
          numberOfLines={1}
          style={complete && styles.completedText}
          variant="bodyStrong"
        >
          {exercise.name}
          {exercise.weightMode === 'per_hand' ? ' · el' : ''}
        </AppText>
        <AppText
          accessibilityLabel={previousSummary.accessibility}
          numberOfLines={1}
          tone="muted"
          variant="caption"
        >
          {previousPerformanceLoading
            ? 'Geçmiş yükleniyor'
            : previousPerformanceError
              ? appStrings.workout.previousPerformanceUnavailable
              : previousSummary.compact}
        </AppText>
        {error ? (
          <AppText
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            numberOfLines={1}
            tone="danger"
            variant="caption"
          >
            {error}
          </AppText>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityLabel={`${exercise.name}: ${completedLabel}. ${appStrings.workout.editSets}`}
        accessibilityRole="button"
        hitSlop={theme.spacing.xs}
        onPress={onOpenEditor}
        style={styles.counterCell}
      >
        <AppText
          style={styles.tabular}
          tone={complete ? 'success' : 'muted'}
          variant="caption"
        >
          {counter}
        </AppText>
      </Pressable>
      <InlineNumericWheelField
        accessibilityLabel={`${exercise.name} ${appStrings.workout.repetitionLabel}`}
        disabled={complete || pending}
        formatValue={String}
        inputMode="numeric"
        keyboardType="number-pad"
        max={1000}
        min={1}
        onChangeText={setRepetitions}
        parseValue={parseRepetitionInput}
        step={1}
        style={styles.repetitionInput}
        unit="tekrar"
        value={repetitions}
      />
      <InlineNumericWheelField
        accessibilityHint={
          previousPerformanceError ? undefined : previousSummary.accessibility
        }
        accessibilityLabel={`${exercise.name} ${appStrings.workout.weightLabel}`}
        disabled={complete || pending}
        formatValue={formatWorkoutWeight}
        inputMode="decimal"
        keyboardType="decimal-pad"
        max={2000}
        min={2.5}
        onChangeText={setWeight}
        parseValue={parseWeightInput}
        step={2.5}
        style={styles.weightInput}
        unit="kilogram"
        value={weight}
      />
      <Pressable
        accessibilityLabel={
          complete
            ? `${exercise.name}: ${appStrings.workout.completedExercise}`
            : `${exercise.name} setini tamamla`
        }
        accessibilityRole="button"
        accessibilityState={{ busy: pending, disabled: complete || pending }}
        disabled={complete || pending}
        onPress={() => void submit()}
        style={({ pressed }) => [
          styles.completeButton,
          complete && styles.completeButtonDone,
          pressed && styles.pressed,
        ]}
      >
        <AppIcon
          color={complete ? theme.colors.success : theme.colors.text}
          name={pending ? 'loading' : complete ? 'check-all' : 'check'}
          size={theme.iconSizes.sm}
        />
      </Pressable>
    </View>
  );
}

export const workoutTableColumns = {
  action: 44,
  counter: 38,
  repetitions: 44,
  weight: 56,
} as const;

const styles = StyleSheet.create({
  completeButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.sm,
    height: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    width: workoutTableColumns.action,
  },
  completeButtonDone: {
    backgroundColor: workoutTheme.completed,
    borderColor: theme.colors.success,
    borderWidth: theme.borders.thin,
  },
  completedRow: { backgroundColor: workoutTheme.completed },
  completedText: { color: theme.colors.textMuted },
  counterCell: {
    alignItems: 'center',
    height: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    width: workoutTableColumns.counter,
  },
  nameCell: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.72 },
  repetitionInput: { width: workoutTableColumns.repetitions },
  row: {
    alignItems: 'center',
    backgroundColor: workoutTheme.surface,
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: 56,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  tabular: { fontVariant: ['tabular-nums'], textAlign: 'center' },
  weightInput: { width: workoutTableColumns.weight },
});
