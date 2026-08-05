import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { EffortInput } from '@/features/workouts/components/effort-input';
import { InlineNumericWheelField } from '@/features/workouts/components/inline-numeric-wheel-field';
import { SetTypeSelector } from '@/features/workouts/components/set-type-selector';
import type { ExerciseAppearance } from '@/features/workouts/domain/exercise-performance';
import type { WeightUnit } from '@/features/profile/profile-preferences';
import type {
  WorkoutEffortMode,
  WorkoutSessionExercise,
  WorkoutSetType,
} from '@/features/workouts/domain/models';
import { formatPreviousPerformance } from '@/features/workouts/utils/exercise-performance';
import {
  adjustWeight,
  displayedWeightToKg,
  formatWorkoutWeight,
  parseRepetitionInput,
  parseWeightInput,
  weightForDisplay,
} from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type CompletionMetadata = {
  effortMode: 'rpe' | 'rir' | null;
  effortValue: number | null;
  setType: WorkoutSetType;
};

type WorkoutExerciseRowProps = {
  defaultEffortMode?: WorkoutEffortMode;
  exercise: WorkoutSessionExercise;
  onComplete: (
    setId: number,
    weightKg: number,
    actualReps: number,
    metadata: CompletionMetadata
  ) => Promise<void>;
  onOpenEditor: () => void;
  onOpenHistory?: () => void;
  onNumericGestureActiveChange?: (active: boolean) => void;
  onMove?: (direction: 'up' | 'down') => void;
  onRemove?: () => void;
  onRestDurationChange?: (seconds: number) => void;
  onReplace?: () => void;
  onSkip?: () => void;
  onSupersetToggle?: () => void;
  supersetSelected?: boolean;
  selected?: boolean;
  previousPerformance?: ExerciseAppearance | null;
  previousPerformanceError?: boolean;
  previousPerformanceLoading?: boolean;
  weightUnit?: WeightUnit;
};

export function WorkoutExerciseRow({
  defaultEffortMode = 'off',
  exercise,
  onComplete,
  onOpenEditor,
  onOpenHistory,
  onNumericGestureActiveChange,
  onMove,
  onRemove,
  onRestDurationChange,
  onReplace,
  onSkip,
  onSupersetToggle,
  previousPerformance = null,
  previousPerformanceError = false,
  previousPerformanceLoading = false,
  supersetSelected = false,
  selected = false,
  weightUnit = 'kg',
}: WorkoutExerciseRowProps) {
  const completedCount = exercise.sets.filter((set) => set.isCompleted).length;
  const nextSet = exercise.sets.find((set) => !set.isCompleted) ?? null;
  const displayedSet = nextSet ?? exercise.sets.at(-1) ?? null;
  const complete = completedCount === exercise.sets.length;
  const lastCompletedSet = [...exercise.sets]
    .reverse()
    .find((set) => set.isCompleted);
  const previousWorkoutSet = nextSet
    ? (previousPerformance?.sets.find(
        (set) => set.setNumber === nextSet.setNumber
      ) ?? previousPerformance?.sets.at(-1))
    : null;
  const [weight, setWeight] = useState('');
  const [repetitions, setRepetitions] = useState('');
  const [setType, setSetType] = useState<WorkoutSetType>('working');
  const [effortMode, setEffortMode] = useState<WorkoutEffortMode>('off');
  const [effort, setEffort] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const previousSummary = formatPreviousPerformance(
    previousPerformance,
    weightUnit
  );

  useEffect(() => {
    setWeight(
      displayedSet
        ? formatWorkoutWeight(
            weightForDisplay(displayedSet.weightKg, weightUnit)
          )
        : ''
    );
    setRepetitions(
      displayedSet
        ? String(displayedSet.actualReps ?? displayedSet.targetReps ?? 12)
        : ''
    );
    setSetType(displayedSet?.setType ?? 'working');
    setEffortMode(displayedSet?.effortMode ?? defaultEffortMode);
    setEffort(
      displayedSet?.effortValue === null ||
        displayedSet?.effortValue === undefined
        ? ''
        : String(displayedSet.effortValue)
    );
    setError(null);
  }, [defaultEffortMode, displayedSet, weightUnit]);

  const submit = async () => {
    if (!nextSet || pendingRef.current) return;
    const parsedWeight = parseWeightInput(weight);
    const parsedRepetitions = parseRepetitionInput(repetitions);
    const parsedEffort =
      effortMode === 'off' ? null : Number(effort.trim().replace(',', '.'));
    const effortValid =
      effortMode === 'off' ||
      (Number.isFinite(parsedEffort) &&
        (effortMode === 'rpe'
          ? parsedEffort! >= 1 &&
            parsedEffort! <= 10 &&
            (parsedEffort! * 2) % 1 === 0
          : Number.isSafeInteger(parsedEffort) &&
            parsedEffort! >= 0 &&
            parsedEffort! <= 10));
    if (parsedWeight === null || parsedRepetitions === null || !effortValid) {
      setError(
        !effortValid
          ? effortMode === 'rpe'
            ? 'RPE 1–10 arasında ve 0,5 adımlı olmalı.'
            : 'RIR 0–10 arasında tam sayı olmalı.'
          : appStrings.workout.invalidSet
      );
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onComplete(
        nextSet.id,
        displayedWeightToKg(parsedWeight, weightUnit),
        parsedRepetitions,
        {
          effortMode: effortMode === 'off' ? null : effortMode,
          effortValue: parsedEffort,
          setType,
        }
      );
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
      style={[
        styles.card,
        selected && styles.selectedCard,
        complete && styles.completedCard,
      ]}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityHint={previousSummary.accessibility}
          accessibilityLabel={`${exercise.name} geçmişini aç`}
          accessibilityRole="button"
          disabled={!onOpenHistory}
          onPress={onOpenHistory}
          style={styles.nameCell}
        >
          <AppText numberOfLines={1} variant="bodyStrong">
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
          {exercise.supersetGroupId ? (
            <AppText
              accessibilityLabel="Superset grubu"
              tone="primary"
              variant="caption"
            >
              Superset · sıra {(exercise.supersetOrder ?? 0) + 1}
            </AppText>
          ) : null}
          {error ? (
            <AppText
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              selectable
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
          max={100}
          min={1}
          onChangeText={setRepetitions}
          onGestureActiveChange={onNumericGestureActiveChange}
          parseValue={parseRepetitionInput}
          step={1}
          style={styles.repetitionInput}
          unit="tekrar"
          value={repetitions}
        />
        <InlineNumericWheelField
          accessibilityLabel={`${exercise.name} ${appStrings.workout.weightLabel}`}
          disabled={complete || pending}
          formatValue={formatWorkoutWeight}
          inputMode="decimal"
          keyboardType="decimal-pad"
          max={2000}
          min={0}
          onChangeText={setWeight}
          onGestureActiveChange={onNumericGestureActiveChange}
          parseValue={parseWeightInput}
          step={2.5}
          style={styles.weightInput}
          unit={weightUnit === 'lb' ? 'libre' : 'kilogram'}
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
      {!complete ? (
        <View style={styles.fastEntry}>
          <View style={styles.managementActions}>
            {onSkip ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSkip}
                style={styles.managementAction}
              >
                <AppText variant="caption">
                  {exercise.isSkipped ? 'Devam et' : 'Atla'}
                </AppText>
              </Pressable>
            ) : null}
            {onMove ? (
              <>
                <Pressable
                  accessibilityLabel="Hareketi yukarı taşı"
                  accessibilityRole="button"
                  onPress={() => onMove('up')}
                  style={styles.managementAction}
                >
                  <AppText variant="caption">Yukarı</AppText>
                </Pressable>
                <Pressable
                  accessibilityLabel="Hareketi aşağı taşı"
                  accessibilityRole="button"
                  onPress={() => onMove('down')}
                  style={styles.managementAction}
                >
                  <AppText variant="caption">Aşağı</AppText>
                </Pressable>
              </>
            ) : null}
            {onReplace ? (
              <Pressable
                accessibilityRole="button"
                onPress={onReplace}
                style={styles.managementAction}
              >
                <AppText variant="caption">Değiştir</AppText>
              </Pressable>
            ) : null}
            {onRemove && completedCount === 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRemove}
                style={styles.managementAction}
              >
                <AppText tone="danger" variant="caption">
                  Kaldır
                </AppText>
              </Pressable>
            ) : null}
            {onSupersetToggle ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSupersetToggle}
                style={styles.managementAction}
              >
                <AppText
                  tone={supersetSelected ? 'primary' : 'muted'}
                  variant="caption"
                >
                  {supersetSelected ? 'Grup seçildi' : 'Superset'}
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.quickWeights}>
            {lastCompletedSet ? (
              <Pressable
                accessibilityLabel="Son tamamlanan setin ağırlık ve tekrarını kopyala"
                accessibilityRole="button"
                disabled={pending}
                onPress={() => {
                  setWeight(
                    formatWorkoutWeight(
                      weightForDisplay(lastCompletedSet.weightKg, weightUnit)
                    )
                  );
                  setRepetitions(
                    String(
                      lastCompletedSet.actualReps ?? lastCompletedSet.targetReps
                    )
                  );
                }}
                style={styles.quickWeight}
              >
                <AppText variant="caption">Son seti kopyala</AppText>
              </Pressable>
            ) : null}
            {previousWorkoutSet ? (
              <Pressable
                accessibilityLabel="Geçen antrenmandaki karşılık gelen seti kopyala"
                accessibilityRole="button"
                disabled={pending}
                onPress={() => {
                  setWeight(
                    formatWorkoutWeight(
                      weightForDisplay(previousWorkoutSet.weightKg, weightUnit)
                    )
                  );
                  setRepetitions(String(previousWorkoutSet.actualReps));
                }}
                style={styles.quickWeight}
              >
                <AppText variant="caption">Geçen seti kopyala</AppText>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.quickWeights}>
            {[-5, -2.5, 2.5, 5].map((delta) => (
              <Pressable
                accessibilityLabel={`Ağırlığı ${Math.abs(delta)} ${weightUnit === 'lb' ? 'libre' : 'kilogram'} ${delta < 0 ? 'azalt' : 'artır'}`}
                accessibilityRole="button"
                disabled={pending}
                key={delta}
                onPress={() => {
                  const current = parseWeightInput(weight) ?? 0;
                  setWeight(formatWorkoutWeight(adjustWeight(current, delta)));
                }}
                style={styles.quickWeight}
              >
                <AppText variant="caption">
                  {delta > 0 ? '+' : ''}
                  {String(delta).replace('.', ',')}
                </AppText>
              </Pressable>
            ))}
          </View>
          <SetTypeSelector
            disabled={pending}
            onChange={setSetType}
            value={setType}
          />
          {onRestDurationChange ? (
            <View style={styles.quickWeights}>
              {[60, 90, 120, 180].map((seconds) => (
                <Pressable
                  accessibilityLabel={`${exercise.name} dinlenmesini ${seconds} saniye yap`}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: exercise.restDurationSeconds === seconds,
                  }}
                  key={seconds}
                  onPress={() => onRestDurationChange(seconds)}
                  style={styles.quickWeight}
                >
                  <AppText
                    tone={
                      exercise.restDurationSeconds === seconds
                        ? 'primary'
                        : 'muted'
                    }
                    variant="caption"
                  >
                    {seconds} sn
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
          <EffortInput
            disabled={pending}
            mode={effortMode}
            onModeChange={(mode) => {
              setEffortMode(mode);
              if (mode === 'off') setEffort('');
            }}
            onValueChange={setEffort}
            value={effort}
          />
        </View>
      ) : null}
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
  card: {
    backgroundColor: workoutTheme.surface,
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
  },
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
  completedCard: { backgroundColor: workoutTheme.completed },
  counterCell: {
    alignItems: 'center',
    height: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    width: workoutTableColumns.counter,
  },
  fastEntry: { gap: theme.spacing.sm, padding: theme.spacing.sm },
  nameCell: { flex: 1, minWidth: 0 },
  managementAction: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: theme.layout.compactTouchTarget,
    paddingHorizontal: theme.spacing.xs,
  },
  managementActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  pressed: { opacity: 0.72 },
  quickWeight: {
    alignItems: 'center',
    backgroundColor: workoutTheme.input,
    borderRadius: theme.radii.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.layout.compactTouchTarget,
  },
  quickWeights: { flexDirection: 'row', gap: theme.spacing.xs },
  repetitionInput: { width: workoutTableColumns.repetitions },
  selectedCard: {
    borderColor: theme.colors.primary,
    borderWidth: theme.borders.thin,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: 56,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  tabular: { fontVariant: ['tabular-nums'], textAlign: 'center' },
  weightInput: { width: workoutTableColumns.weight },
});
