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
  Keyboard,
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
import { ExerciseDefaultsModal } from '@/features/workouts/components/exercise-defaults-modal';
import type { ExerciseDefaultsFormValues } from '@/features/workouts/components/exercise-defaults-form';
import {
  getProgramExerciseDropIndex,
  PROGRAM_EXERCISE_PANEL_GAP,
  PROGRAM_EXERCISE_PANEL_HEIGHT,
  ProgramExercisePanel,
} from '@/features/workouts/components/program-exercise-panel';
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
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type DefaultsEditor = {
  exercise: WorkoutExercise;
  originalValues: ExerciseDefaultsFormValues;
  values: ExerciseDefaultsFormValues;
};

type ExerciseDragState = {
  distanceY: number;
  exerciseId: number;
  initialIndex: number;
  targetIndex: number;
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
  const [exerciseDrag, setExerciseDrag] = useState<ExerciseDragState | null>(
    null
  );
  const exerciseDragRef = useRef<ExerciseDragState | null>(null);

  const metadataDirty = Boolean(
    originalDraft && draft && isWorkoutDayDraftDirty(originalDraft, draft)
  );
  const defaultsDirty = Boolean(
    defaultsEditor &&
    JSON.stringify(defaultsEditor.values) !==
      JSON.stringify(defaultsEditor.originalValues)
  );
  useUnsavedChangesGuard(metadataDirty || defaultsDirty);

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
    const scheduleWeekdays = normalizeWeekdays(draft.scheduleWeekdays);
    if (!name) {
      setSaveError(appStrings.workout.invalidDayName);
      return;
    }
    if (subtitle === null) {
      setSaveError(appStrings.workout.invalidDayDescription);
      return;
    }
    if (scheduleWeekdays.length === 0) {
      setSaveError(appStrings.workout.invalidDaySchedule);
      return;
    }
    savingDayRef.current = true;
    setSavingDay(true);
    setSaveError(null);
    try {
      const normalized = {
        name,
        scheduleWeekdays,
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
      Keyboard.dismiss();
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

  const closeDefaultsEditor = () => {
    if (!defaultsEditor) return;
    const close = () => {
      Keyboard.dismiss();
      setDefaultsEditor(null);
      setDefaultsErrors({});
    };
    if (!defaultsDirty) {
      close();
      return;
    }
    Alert.alert(
      appStrings.workout.discardTitle,
      appStrings.workout.discardDescription,
      [
        { style: 'cancel', text: appStrings.workout.keepEditing },
        {
          onPress: close,
          style: 'destructive',
          text: appStrings.workout.discardConfirm,
        },
      ]
    );
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
      const currentIndex = day?.exercises.findIndex(
        (exercise) => exercise.id === exerciseId
      );
      if (currentIndex !== undefined && currentIndex >= 0) {
        const nextIndex =
          direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        AccessibilityInfo.announceForAccessibility(
          `${nextIndex + 1}. sıraya taşındı.`
        );
      }
    } catch {
      setSaveError(appStrings.workout.reorderError);
    } finally {
      operationRef.current = false;
      setPendingExerciseId(null);
    }
  };

  const beginExerciseDrag = (exerciseId: number, initialIndex: number) => {
    if (operationRef.current || exerciseDragRef.current) return;
    const next = {
      distanceY: 0,
      exerciseId,
      initialIndex,
      targetIndex: initialIndex,
    };
    exerciseDragRef.current = next;
    setExerciseDrag(next);
  };

  const moveExerciseDrag = (distanceY: number) => {
    const current = exerciseDragRef.current;
    if (!current || !day) return;
    const next = {
      ...current,
      distanceY,
      targetIndex: getProgramExerciseDropIndex(
        current.initialIndex,
        distanceY,
        day.exercises.length
      ),
    };
    exerciseDragRef.current = next;
    setExerciseDrag(next);
  };

  const cancelExerciseDrag = () => {
    exerciseDragRef.current = null;
    setExerciseDrag(null);
  };

  const finishExerciseDrag = async (distanceY: number) => {
    const current = exerciseDragRef.current;
    if (!current || !day || operationRef.current) return;
    const targetIndex = getProgramExerciseDropIndex(
      current.initialIndex,
      distanceY,
      day.exercises.length
    );
    cancelExerciseDrag();
    if (targetIndex === current.initialIndex) return;
    operationRef.current = true;
    setPendingExerciseId(current.exerciseId);
    setSaveError(null);
    try {
      await createWorkoutProgramRepository(database).reorderExerciseToIndex(
        dayId,
        current.exerciseId,
        targetIndex
      );
      await load();
      AccessibilityInfo.announceForAccessibility(
        `${targetIndex + 1}. sıraya taşındı.`
      );
    } catch {
      setSaveError(appStrings.workout.reorderError);
      await load();
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

  const draggedExercise = exerciseDrag
    ? (day.exercises.find(
        (exercise) => exercise.id === exerciseDrag.exerciseId
      ) ?? null)
    : null;
  const exerciseRowPitch =
    PROGRAM_EXERCISE_PANEL_HEIGHT + PROGRAM_EXERCISE_PANEL_GAP;

  return (
    <Screen
      backgroundColor={workoutTheme.background}
      edges={['top', 'bottom']}
      keyboardAware
      scrollViewProps={{ scrollEnabled: exerciseDrag === null }}
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
        {day.exercises.length === 0 ? (
          <EmptyState
            description={appStrings.workout.noProgramExercisesDescription}
            icon="dumbbell"
            title={appStrings.workout.noProgramExercisesTitle}
          />
        ) : null}
        <View style={styles.exerciseList}>
          {day.exercises.map((exercise, index) => {
            const isDragged = exercise.id === exerciseDrag?.exerciseId;
            const shiftUp = Boolean(
              exerciseDrag &&
              exerciseDrag.initialIndex < exerciseDrag.targetIndex &&
              index > exerciseDrag.initialIndex &&
              index <= exerciseDrag.targetIndex
            );
            const shiftDown = Boolean(
              exerciseDrag &&
              exerciseDrag.targetIndex < exerciseDrag.initialIndex &&
              index >= exerciseDrag.targetIndex &&
              index < exerciseDrag.initialIndex
            );
            return (
              <View
                key={exercise.id}
                style={
                  shiftUp
                    ? { transform: [{ translateY: -exerciseRowPitch }] }
                    : shiftDown
                      ? { transform: [{ translateY: exerciseRowPitch }] }
                      : undefined
                }
              >
                <ProgramExercisePanel
                  disabled={
                    pendingExerciseId === exercise.id ||
                    operationRef.current ||
                    (exerciseDrag !== null && !isDragged)
                  }
                  exercise={exercise}
                  index={index}
                  onAccessibleMove={(direction) =>
                    void reorder(exercise.id, direction)
                  }
                  onDragCancel={cancelExerciseDrag}
                  onDragEnd={(distanceY) => void finishExerciseDrag(distanceY)}
                  onDragMove={moveExerciseDrag}
                  onDragStart={() => beginExerciseDrag(exercise.id, index)}
                  onEditDefaults={() => {
                    const values = toDefaultsValues(exercise);
                    setDefaultsErrors({});
                    setSaveError(null);
                    setDefaultsEditor({
                      exercise,
                      originalValues: values,
                      values,
                    });
                  }}
                  onOpenHistory={() =>
                    router.push(
                      `/workout/exercise/${exercise.id}/history` as Href
                    )
                  }
                  onRemove={() => remove(exercise)}
                  placeholder={isDragged}
                  totalCount={day.exercises.length}
                />
              </View>
            );
          })}
          {exerciseDrag ? (
            <View
              pointerEvents="none"
              style={[
                styles.dropIndicator,
                { top: exerciseDrag.targetIndex * exerciseRowPitch },
              ]}
              testID="program-exercise-drop-placeholder"
            />
          ) : null}
          {draggedExercise && exerciseDrag ? (
            <View
              pointerEvents="none"
              style={[
                styles.dragOverlay,
                {
                  transform: [
                    {
                      translateY:
                        exerciseDrag.initialIndex * exerciseRowPitch +
                        exerciseDrag.distanceY,
                    },
                  ],
                },
              ]}
            >
              <ProgramExercisePanel
                disabled
                dragging
                exercise={draggedExercise}
                index={exerciseDrag.targetIndex}
                onAccessibleMove={() => undefined}
                onDragCancel={() => undefined}
                onDragEnd={() => undefined}
                onDragMove={() => undefined}
                onDragStart={() => undefined}
                onEditDefaults={() => undefined}
                onOpenHistory={() => undefined}
                onRemove={() => undefined}
                totalCount={day.exercises.length}
              />
            </View>
          ) : null}
        </View>
      </View>
      <ExerciseDefaultsModal
        errors={defaultsErrors}
        exercise={defaultsEditor?.exercise ?? null}
        onChange={(values) =>
          setDefaultsEditor((current) =>
            current ? { ...current, values } : current
          )
        }
        onClose={closeDefaultsEditor}
        onSave={() => void saveDefaults()}
        saveError={saveError}
        saving={savingExercise}
        values={defaultsEditor?.values ?? null}
        visible={defaultsEditor !== null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start' },
  dragOverlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  dropIndicator: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.pill,
    height: theme.borders.strong,
    left: theme.spacing.sm,
    position: 'absolute',
    right: theme.spacing.sm,
    zIndex: 3,
  },
  exerciseList: {
    gap: PROGRAM_EXERCISE_PANEL_GAP,
    position: 'relative',
  },
  exerciseSection: { gap: theme.spacing.md },
  formSection: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    gap: theme.spacing.lg,
    padding: theme.spacing.md,
  },
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
});
