import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { appStrings } from '@/constants/strings';
import {
  ExerciseDefaultsForm,
  type ExerciseDefaultsFormValues,
} from '@/features/workouts/components/exercise-defaults-form';
import {
  createWorkoutProgramRepository,
  WorkoutProgramError,
} from '@/features/workouts/data/workout-program-repository';
import { createWorkoutPlanRepository } from '@/features/workouts/data/workout-plan-repository';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';
import type {
  WorkoutDayDetails,
  WorkoutDayDraft,
  WorkoutExercise,
} from '@/features/workouts/domain/models';
import { useUnsavedChangesGuard } from '@/features/workouts/hooks/use-unsaved-changes-guard';
import { getWorkoutWeekdayLabel } from '@/features/workouts/utils/workout-formatters';
import {
  createExerciseDefaultsDraft,
  isWorkoutDayDraftDirty,
  MAX_WORKOUT_DAY_NAME_LENGTH,
  normalizeOptionalText,
  normalizeRequiredName,
  normalizeWeekdays,
  parseDefaultRepetitions,
  parseDefaultSetCount,
  parseDefaultWeight,
} from '@/features/workouts/utils/workout-program-validation';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type DefaultsEditor = {
  exercise: WorkoutExercise;
  values: ExerciseDefaultsFormValues;
};

type DefaultsErrors = Partial<
  Record<'setCount' | 'targetReps' | 'weight', string>
>;

function toDayDraft(day: WorkoutDayDetails): WorkoutDayDraft {
  return {
    name: day.name,
    scheduleWeekdays: [...day.scheduleWeekdays],
    subtitle: day.subtitle,
  };
}

function toDefaultsValues(
  exercise: WorkoutExercise
): ExerciseDefaultsFormValues {
  return {
    setCount: String(exercise.setCount),
    targetReps: String(exercise.targetReps),
    weight: String(exercise.weightKg).replace('.', ','),
    weightMode: exercise.weightMode,
  };
}

export function WorkoutProgramDayScreen() {
  const { dayId: rawDayId } = useLocalSearchParams<{ dayId: string }>();
  const dayId = Number(rawDayId);
  const database = useSQLiteContext();
  const router = useRouter();
  const [day, setDay] = useState<WorkoutDayDetails | null>(null);
  const [originalDraft, setOriginalDraft] = useState<WorkoutDayDraft | null>(
    null
  );
  const [draft, setDraft] = useState<WorkoutDayDraft | null>(null);
  const originalDraftRef = useRef<WorkoutDayDraft | null>(null);
  const draftRef = useRef<WorkoutDayDraft | null>(null);
  const [activeSessionForDay, setActiveSessionForDay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingDay, setSavingDay] = useState(false);
  const savingDayRef = useRef(false);
  const [defaultsEditor, setDefaultsEditor] = useState<DefaultsEditor | null>(
    null
  );
  const [defaultsErrors, setDefaultsErrors] = useState<DefaultsErrors>({});
  const [savingExercise, setSavingExercise] = useState(false);
  const savingExerciseRef = useRef(false);
  const [pendingExerciseId, setPendingExerciseId] = useState<number | null>(
    null
  );
  const operationRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);

  const metadataDirty = Boolean(
    originalDraft && draft && isWorkoutDayDraftDirty(originalDraft, draft)
  );
  useUnsavedChangesGuard(metadataDirty || defaultsEditor !== null);

  const assignDraft = useCallback((next: WorkoutDayDraft) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const load = useCallback(async () => {
    if (!Number.isSafeInteger(dayId) || dayId <= 0) {
      setDay(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const [nextDay, activeSession] = await Promise.all([
        createWorkoutPlanRepository(database).getWorkoutDayDetails(dayId),
        createWorkoutSessionRepository(database).getActiveSession(),
      ]);
      setDay(nextDay);
      setActiveSessionForDay(activeSession?.workoutDayId === dayId);
      if (nextDay) {
        const nextOriginal = toDayDraft(nextDay);
        const current = draftRef.current;
        const previousOriginal = originalDraftRef.current;
        originalDraftRef.current = nextOriginal;
        setOriginalDraft(nextOriginal);
        if (
          !current ||
          !previousOriginal ||
          !isWorkoutDayDraftDirty(previousOriginal, current)
        ) {
          assignDraft(nextOriginal);
        }
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [assignDraft, database, dayId]);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      void load();
    }, [load, reloadKey])
  );

  const saveDay = async () => {
    if (!draft || savingDayRef.current) return;
    const name = normalizeRequiredName(draft.name, MAX_WORKOUT_DAY_NAME_LENGTH);
    const subtitle = normalizeOptionalText(draft.subtitle);
    if (!name) {
      setSaveError(appStrings.workout.invalidDayName);
      return;
    }
    if (subtitle === null) {
      setSaveError(appStrings.workout.invalidDayDescription);
      return;
    }
    savingDayRef.current = true;
    setSavingDay(true);
    setSaveError(null);
    try {
      const normalized = {
        name,
        scheduleWeekdays: normalizeWeekdays(draft.scheduleWeekdays),
        subtitle,
      };
      await createWorkoutProgramRepository(database).updateWorkoutDay(
        dayId,
        normalized
      );
      originalDraftRef.current = normalized;
      draftRef.current = normalized;
      setOriginalDraft(normalized);
      setDraft(normalized);
      await load();
      AccessibilityInfo.announceForAccessibility(appStrings.workout.daySaved);
    } catch (error) {
      if (error instanceof WorkoutProgramError) {
        if (error.code === 'schedule_conflict') {
          const weekday = getWorkoutWeekdayLabel(error.details?.weekday ?? 0);
          setSaveError(
            `${weekday}, ${error.details?.dayName ?? appStrings.workout.scheduleConflict} gününe atanmış.`
          );
        } else if (error.code === 'duplicate_day_name') {
          setSaveError(appStrings.workout.duplicateDayName);
        } else {
          setSaveError(appStrings.workout.saveErrorProgram);
        }
      } else {
        setSaveError(appStrings.workout.saveErrorProgram);
      }
    } finally {
      savingDayRef.current = false;
      setSavingDay(false);
    }
  };

  const toggleWeekday = (weekday: number) => {
    if (!draft) return;
    const selected = draft.scheduleWeekdays.includes(weekday);
    assignDraft({
      ...draft,
      scheduleWeekdays: selected
        ? draft.scheduleWeekdays.filter((value) => value !== weekday)
        : [...draft.scheduleWeekdays, weekday],
    });
  };

  const validateDefaults = (
    values: ExerciseDefaultsFormValues
  ): DefaultsErrors => ({
    ...(parseDefaultSetCount(values.setCount) === null
      ? { setCount: appStrings.workout.invalidDefaultSets }
      : {}),
    ...(parseDefaultRepetitions(values.targetReps) === null
      ? { targetReps: appStrings.workout.invalidDefaultRepetitions }
      : {}),
    ...(parseDefaultWeight(values.weight) === null
      ? { weight: appStrings.workout.invalidDefaultWeight }
      : {}),
  });

  const saveDefaults = async () => {
    if (!defaultsEditor || savingExerciseRef.current) return;
    const errors = validateDefaults(defaultsEditor.values);
    setDefaultsErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const defaults = createExerciseDefaultsDraft(
      defaultsEditor.values.setCount,
      defaultsEditor.values.targetReps,
      defaultsEditor.values.weight,
      defaultsEditor.values.weightMode
    );
    if (!defaults) return;
    savingExerciseRef.current = true;
    setSavingExercise(true);
    setSaveError(null);
    try {
      await createWorkoutProgramRepository(database).updateExerciseDefaults(
        dayId,
        defaultsEditor.exercise.id,
        defaults
      );
      setDefaultsEditor(null);
      setDefaultsErrors({});
      await load();
      AccessibilityInfo.announceForAccessibility(
        appStrings.workout.defaultsSaved
      );
    } catch {
      setSaveError(appStrings.workout.saveErrorProgram);
    } finally {
      savingExerciseRef.current = false;
      setSavingExercise(false);
    }
  };

  const reorder = async (exerciseId: number, direction: 'up' | 'down') => {
    if (operationRef.current) return;
    operationRef.current = true;
    setPendingExerciseId(exerciseId);
    setSaveError(null);
    try {
      await createWorkoutProgramRepository(database).reorderExercise(
        dayId,
        exerciseId,
        direction
      );
      await load();
    } catch {
      setSaveError(appStrings.workout.reorderError);
    } finally {
      operationRef.current = false;
      setPendingExerciseId(null);
    }
  };

  const remove = (exercise: WorkoutExercise) => {
    if (!day || operationRef.current) return;
    const isFinal = day.exercises.length === 1;
    Alert.alert(
      isFinal
        ? appStrings.workout.removeFinalExerciseTitle
        : appStrings.workout.removeExerciseTitle,
      isFinal
        ? appStrings.workout.removeFinalExerciseDescription
        : appStrings.workout.removeExerciseDescription,
      [
        { style: 'cancel', text: appStrings.workout.keepExercise },
        {
          onPress: () => {
            operationRef.current = true;
            setPendingExerciseId(exercise.id);
            void createWorkoutProgramRepository(database)
              .removeExerciseFromDay(dayId, exercise.id)
              .then(load)
              .catch(() => setSaveError(appStrings.workout.removeError))
              .finally(() => {
                operationRef.current = false;
                setPendingExerciseId(null);
              });
          },
          style: 'destructive',
          text: appStrings.workout.removeConfirm,
        },
      ]
    );
  };

  if (loading && !day) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        <EmptyState
          description={appStrings.workout.loading}
          icon="calendar-edit"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        <EmptyState
          description={appStrings.workout.loadError}
          icon="alert-circle-outline"
          title={appStrings.database.errorTitle}
        />
        <AppButton
          label={appStrings.workout.retry}
          onPress={() => setReloadKey((value) => value + 1)}
        />
      </Screen>
    );
  }

  if (!day || !draft) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        <EmptyState
          description={appStrings.workout.dayNotFoundDescription}
          icon="calendar-remove"
          title={appStrings.workout.dayNotFound}
        />
        <AppButton
          label={appStrings.common.goBack}
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen
      backgroundColor={workoutTheme.background}
      edges={['top', 'bottom']}
      keyboardAware
    >
      <AppButton
        label={appStrings.common.goBack}
        onPress={() => router.back()}
        style={styles.backButton}
        variant="ghost"
      />
      <AppText accessibilityRole="header" variant="title">
        {day.name}
      </AppText>
      {activeSessionForDay ? (
        <View style={styles.notice}>
          <AppText selectable tone="muted" variant="caption">
            {appStrings.workout.changesNextWorkout}
          </AppText>
        </View>
      ) : null}
      {saveError ? (
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          selectable
          tone="danger"
        >
          {saveError}
        </AppText>
      ) : null}
      <View style={styles.formSection}>
        <AppTextInput
          label={appStrings.workout.dayName}
          maxLength={MAX_WORKOUT_DAY_NAME_LENGTH}
          onChangeText={(name) => assignDraft({ ...draft, name })}
          placeholder={appStrings.workout.dayNamePlaceholder}
          value={draft.name}
        />
        <AppTextInput
          label={appStrings.workout.dayDescription}
          maxLength={120}
          multiline
          onChangeText={(subtitle) => assignDraft({ ...draft, subtitle })}
          placeholder={appStrings.workout.dayDescriptionPlaceholder}
          value={draft.subtitle}
        />
        <View style={styles.weekdaySection}>
          <AppText variant="bodyStrong">{appStrings.workout.weekdays}</AppText>
          <View style={styles.weekdays}>
            {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
              const selected = draft.scheduleWeekdays.includes(weekday);
              const label = getWorkoutWeekdayLabel(weekday);
              return (
                <Pressable
                  accessibilityLabel={label}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={weekday}
                  onPress={() => toggleWeekday(weekday)}
                  style={[styles.weekday, selected && styles.weekdaySelected]}
                >
                  <AppText
                    tone={selected ? 'primary' : 'muted'}
                    variant="caption"
                  >
                    {selected ? '✓ ' : ''}
                    {label.slice(0, 3)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <AppButton
          disabled={savingDay || !metadataDirty}
          label={
            savingDay ? appStrings.workout.saving : appStrings.workout.saveDay
          }
          onPress={() => void saveDay()}
        />
      </View>

      <View style={styles.exerciseSection}>
        <SectionHeader title={appStrings.workout.exercisesTitle} />
        <AppButton
          icon="plus"
          label={appStrings.workout.addExercise}
          onPress={() =>
            router.push(`/workout/program/day/${dayId}/add-exercise` as Href)
          }
          variant="secondary"
        />
        <View style={styles.exerciseList}>
          {day.exercises.map((exercise, index) => {
            const pending = pendingExerciseId === exercise.id;
            return (
              <View key={exercise.id} style={styles.exerciseRow}>
                <View
                  accessibilityLabel={`${index + 1}. ${exercise.name}, ${exercise.setCount} set, ${exercise.targetReps} tekrar, ${formatWorkoutWeight(exercise.weightKg)} kg, ${exercise.weightMode === 'per_hand' ? appStrings.workout.perHandWeight : appStrings.workout.totalWeight}`}
                  accessible
                  style={styles.exerciseSummary}
                >
                  <AppText numberOfLines={1} variant="bodyStrong">
                    {index + 1}. {exercise.name}
                  </AppText>
                  <AppText selectable tone="muted" variant="caption">
                    {exercise.setCount} set · {exercise.targetReps} tekrar ·{' '}
                    {formatWorkoutWeight(exercise.weightKg)} kg ·{' '}
                    {exercise.weightMode === 'per_hand'
                      ? appStrings.workout.perHandWeight
                      : appStrings.workout.totalWeight}
                  </AppText>
                </View>
                <View style={styles.actions}>
                  <AppButton
                    accessibilityLabel={`${exercise.name}: ${appStrings.workout.editDefaults}`}
                    disabled={pending}
                    label={appStrings.workout.editDefaults}
                    onPress={() => {
                      setDefaultsErrors({});
                      setDefaultsEditor({
                        exercise,
                        values: toDefaultsValues(exercise),
                      });
                    }}
                    style={styles.wideAction}
                    variant="ghost"
                  />
                  <View style={styles.moveActions}>
                    <AppButton
                      accessibilityLabel={`${exercise.name}: ${appStrings.workout.moveUp}`}
                      disabled={pending || index === 0}
                      icon="arrow-up"
                      label={appStrings.workout.moveUp}
                      onPress={() => void reorder(exercise.id, 'up')}
                      style={styles.moveAction}
                      variant="ghost"
                    />
                    <AppButton
                      accessibilityLabel={`${exercise.name}: ${appStrings.workout.moveDown}`}
                      disabled={pending || index === day.exercises.length - 1}
                      icon="arrow-down"
                      label={appStrings.workout.moveDown}
                      onPress={() => void reorder(exercise.id, 'down')}
                      style={styles.moveAction}
                      variant="ghost"
                    />
                  </View>
                  <AppButton
                    accessibilityLabel={`${exercise.name}: ${appStrings.workout.removeFromDay}`}
                    disabled={pending}
                    label={appStrings.workout.removeFromDay}
                    onPress={() => remove(exercise)}
                    style={styles.wideAction}
                    variant="ghost"
                  />
                </View>
                {defaultsEditor?.exercise.id === exercise.id ? (
                  <View style={styles.defaultsEditor}>
                    <ExerciseDefaultsForm
                      errors={defaultsErrors}
                      exerciseName={exercise.name}
                      onChange={(values) =>
                        setDefaultsEditor({ exercise, values })
                      }
                      values={defaultsEditor.values}
                    />
                    <View style={styles.editorActions}>
                      <AppButton
                        disabled={savingExercise}
                        label={appStrings.workout.closeEditor}
                        onPress={() => {
                          setDefaultsEditor(null);
                          setDefaultsErrors({});
                        }}
                        style={styles.editorAction}
                        variant="ghost"
                      />
                      <AppButton
                        disabled={savingExercise}
                        label={
                          savingExercise
                            ? appStrings.workout.saving
                            : appStrings.workout.saveDefaults
                        }
                        onPress={() => void saveDefaults()}
                        style={styles.editorAction}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm },
  backButton: { alignSelf: 'flex-start' },
  defaultsEditor: {
    borderTopColor: workoutTheme.separator,
    borderTopWidth: theme.borders.hairline,
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  editorAction: { flex: 1 },
  editorActions: { flexDirection: 'row', gap: theme.spacing.sm },
  exerciseList: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    overflow: 'hidden',
  },
  exerciseRow: {
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  exerciseSection: { gap: theme.spacing.md },
  exerciseSummary: { gap: theme.spacing.xs },
  formSection: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    gap: theme.spacing.lg,
    padding: theme.spacing.md,
  },
  moveAction: { flex: 1 },
  moveActions: { flexDirection: 'row', gap: theme.spacing.sm },
  notice: {
    backgroundColor: workoutTheme.surfaceActive,
    borderColor: theme.colors.warning,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    padding: theme.spacing.md,
  },
  weekday: {
    alignItems: 'center',
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thin,
    flexBasis: '22%',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: theme.layout.compactTouchTarget,
    paddingHorizontal: theme.spacing.xs,
  },
  weekdaySection: { gap: theme.spacing.sm },
  weekdaySelected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  wideAction: { width: '100%' },
});
