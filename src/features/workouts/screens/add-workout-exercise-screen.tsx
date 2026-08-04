import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import {
  ExerciseDefaultsForm,
  type ExerciseDefaultsFormValues,
} from '@/features/workouts/components/exercise-defaults-form';
import {
  createWorkoutProgramRepository,
  WorkoutProgramError,
} from '@/features/workouts/data/workout-program-repository';
import { navigateBackOrReplace } from '@/navigation/safe-navigation';
import type { AvailableExercise } from '@/features/workouts/domain/models';
import { useUnsavedChangesGuard } from '@/features/workouts/hooks/use-unsaved-changes-guard';
import {
  createExerciseDefaultsDraft,
  parseDefaultRepetitions,
  parseDefaultSetCount,
  parseDefaultWeight,
} from '@/features/workouts/utils/workout-program-validation';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

const initialDefaults: ExerciseDefaultsFormValues = {
  setCount: '3',
  targetReps: '12',
  weight: '1',
  weightMode: 'total',
};

export function AddWorkoutExerciseScreen() {
  const { dayId: rawDayId } = useLocalSearchParams<{ dayId: string }>();
  const dayId = Number(rawDayId);
  const database = useSQLiteContext();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<AvailableExercise[]>([]);
  const [selected, setSelected] = useState<AvailableExercise | null>(null);
  const [defaults, setDefaults] = useState(initialDefaults);
  const [errors, setErrors] = useState<
    Partial<Record<'setCount' | 'targetReps' | 'weight', string>>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dayMissing, setDayMissing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [numericGestureActive, setNumericGestureActive] = useState(false);
  const allowNavigation = useUnsavedChangesGuard(selected !== null);

  const load = useCallback(async () => {
    if (!Number.isSafeInteger(dayId) || dayId <= 0) {
      setExercises([]);
      setDayMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    setDayMissing(false);
    try {
      const next = await createWorkoutProgramRepository(
        database
      ).getAvailableExercises(dayId, query);
      setExercises(next);
    } catch (error) {
      if (
        error instanceof WorkoutProgramError &&
        error.code === 'day_not_found'
      ) {
        setDayMissing(true);
      } else {
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [database, dayId, query]);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      if (!selected) void load();
    }, [load, reloadKey, selected])
  );

  const save = async () => {
    if (!selected || savingRef.current) return;
    const nextErrors = {
      ...(parseDefaultSetCount(defaults.setCount) === null
        ? { setCount: appStrings.workout.invalidDefaultSets }
        : {}),
      ...(parseDefaultRepetitions(defaults.targetReps) === null
        ? { targetReps: appStrings.workout.invalidDefaultRepetitions }
        : {}),
      ...(parseDefaultWeight(defaults.weight) === null
        ? { weight: appStrings.workout.invalidDefaultWeight }
        : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const parsed = createExerciseDefaultsDraft(
      defaults.setCount,
      defaults.targetReps,
      defaults.weight,
      defaults.weightMode
    );
    if (!parsed) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await createWorkoutProgramRepository(database).addExistingExercise(
        dayId,
        selected.id,
        parsed
      );
      AccessibilityInfo.announceForAccessibility(
        appStrings.workout.exerciseAdded
      );
      allowNavigation();
      navigateBackOrReplace(router, '/(tabs)/workout');
    } catch (error) {
      setSaveError(
        error instanceof WorkoutProgramError &&
          error.code === 'duplicate_exercise'
          ? appStrings.workout.duplicateExercise
          : appStrings.workout.saveErrorProgram
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (selected) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
        keyboardAware
        scrollViewProps={{ scrollEnabled: !numericGestureActive }}
      >
        <AppButton
          label={appStrings.common.goBack}
          onPress={() => setSelected(null)}
          style={styles.backButton}
          variant="ghost"
        />
        <View style={styles.header}>
          <AppText accessibilityRole="header" variant="title">
            {appStrings.workout.configureExercise}
          </AppText>
          <AppText selectable variant="bodyStrong">
            {selected.name}
          </AppText>
          <AppText selectable tone="muted" variant="caption">
            {[selected.muscleGroup, selected.equipment]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
        {saveError ? (
          <AppText accessibilityRole="alert" selectable tone="danger">
            {saveError}
          </AppText>
        ) : null}
        <View style={styles.form}>
          <ExerciseDefaultsForm
            errors={errors}
            exerciseName={selected.name}
            onChange={setDefaults}
            onGestureActiveChange={setNumericGestureActive}
            values={defaults}
          />
          <AppButton
            disabled={saving}
            label={
              saving ? appStrings.workout.saving : appStrings.workout.addToDay
            }
            onPress={() => void save()}
          />
        </View>
      </Screen>
    );
  }

  if (dayMissing) {
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
          onPress={() => navigateBackOrReplace(router, '/(tabs)/workout')}
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
        onPress={() => navigateBackOrReplace(router, '/(tabs)/workout')}
        style={styles.backButton}
        variant="ghost"
      />
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="title">
          {appStrings.workout.addExercise}
        </AppText>
        <AppText selectable tone="muted">
          {appStrings.workout.addExerciseDescription}
        </AppText>
      </View>
      <AppButton
        icon="plus-circle-outline"
        label={appStrings.workout.createExercise}
        onPress={() =>
          router.push(
            `/workout/program/day/${dayId}/add-exercise/custom` as Href
          )
        }
        variant="secondary"
      />
      <AppTextInput
        label={appStrings.workout.searchExercise}
        onChangeText={setQuery}
        placeholder={appStrings.workout.searchExercisePlaceholder}
        value={query}
      />
      {loading ? (
        <EmptyState
          description={appStrings.workout.loading}
          icon="magnify"
          title={appStrings.database.loadingTitle}
        />
      ) : loadError ? (
        <View style={styles.state}>
          <EmptyState
            description={appStrings.workout.loadError}
            icon="alert-circle-outline"
            title={appStrings.database.errorTitle}
          />
          <AppButton
            label={appStrings.workout.retry}
            onPress={() => setReloadKey((value) => value + 1)}
          />
        </View>
      ) : exercises.length === 0 ? (
        <EmptyState
          description={
            query.trim()
              ? appStrings.workout.noSearchResults
              : appStrings.workout.noAvailableExercisesDescription
          }
          icon="dumbbell"
          title={
            query.trim()
              ? appStrings.workout.noSearchResults
              : appStrings.workout.noAvailableExercises
          }
        />
      ) : (
        <View style={styles.list}>
          {exercises.map((exercise) => (
            <Pressable
              accessibilityLabel={`${exercise.name}. ${appStrings.workout.configureExercise}`}
              accessibilityRole="button"
              key={exercise.id}
              onPress={() => {
                setDefaults(initialDefaults);
                setErrors({});
                setSelected(exercise);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowCopy}>
                <AppText numberOfLines={1} variant="bodyStrong">
                  {exercise.name}
                </AppText>
                <AppText selectable tone="muted" variant="caption">
                  {[exercise.muscleGroup, exercise.equipment]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <AppIcon name="chevron-right" />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start' },
  form: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    gap: theme.spacing.lg,
    padding: theme.spacing.md,
  },
  header: { gap: theme.spacing.xs },
  list: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    overflow: 'hidden',
  },
  pressed: { backgroundColor: workoutTheme.surfaceActive },
  row: {
    alignItems: 'center',
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.md,
    minHeight: theme.layout.touchTarget,
    padding: theme.spacing.md,
  },
  rowCopy: { flex: 1, gap: theme.spacing.xs },
  state: { gap: theme.spacing.md },
});
