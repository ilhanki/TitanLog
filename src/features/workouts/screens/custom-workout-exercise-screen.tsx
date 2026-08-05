import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
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
import { createWorkoutPlanRepository } from '@/features/workouts/data/workout-plan-repository';
import { useUnsavedChangesGuard } from '@/features/workouts/hooks/use-unsaved-changes-guard';
import { navigateBackOrReplace } from '@/navigation/safe-navigation';
import {
  createExerciseDefaultsDraft,
  MAX_EXERCISE_NAME_LENGTH,
  normalizeOptionalText,
  normalizeRequiredName,
  parseDefaultRepetitions,
  parseDefaultRestSeconds,
  parseDefaultSetCount,
  parseDefaultWeight,
} from '@/features/workouts/utils/workout-program-validation';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

const initialDefaults: ExerciseDefaultsFormValues = {
  restSeconds: '90',
  setCount: '3',
  targetReps: '12',
  weight: '1',
  weightMode: 'total',
};

type FieldErrors = Partial<
  Record<
    | 'equipment'
    | 'muscleGroup'
    | 'name'
    | 'restSeconds'
    | 'setCount'
    | 'targetReps'
    | 'weight',
    string
  >
>;

export function CustomWorkoutExerciseScreen() {
  const { dayId: rawDayId } = useLocalSearchParams<{ dayId: string }>();
  const dayId = Number(rawDayId);
  const database = useSQLiteContext();
  const router = useRouter();
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [defaults, setDefaults] = useState(initialDefaults);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingDay, setLoadingDay] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dayMissing, setDayMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [numericGestureActive, setNumericGestureActive] = useState(false);
  const savingRef = useRef(false);
  const dirty =
    name.length > 0 ||
    muscleGroup.length > 0 ||
    equipment.length > 0 ||
    JSON.stringify(defaults) !== JSON.stringify(initialDefaults);
  const allowNavigation = useUnsavedChangesGuard(dirty);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setLoadingDay(true);
      setLoadError(false);
      setDayMissing(false);
      if (!Number.isSafeInteger(dayId) || dayId <= 0) {
        setDayMissing(true);
        setLoadingDay(false);
        return () => {
          active = false;
        };
      }
      void createWorkoutPlanRepository(database)
        .getWorkoutDayDetails(dayId)
        .then((day) => {
          if (active) setDayMissing(!day);
        })
        .catch(() => {
          if (active) setLoadError(true);
        })
        .finally(() => {
          if (active) setLoadingDay(false);
        });
      return () => {
        active = false;
      };
    }, [database, dayId, reloadKey])
  );

  const save = async () => {
    if (savingRef.current) return;
    const normalizedName = normalizeRequiredName(
      name,
      MAX_EXERCISE_NAME_LENGTH
    );
    const normalizedMuscleGroup = normalizeOptionalText(muscleGroup);
    const normalizedEquipment = normalizeOptionalText(equipment);
    const nextErrors: FieldErrors = {
      ...(!normalizedName
        ? { name: appStrings.workout.invalidExerciseName }
        : {}),
      ...(normalizedMuscleGroup === null
        ? { muscleGroup: appStrings.workout.invalidOptionalField }
        : {}),
      ...(normalizedEquipment === null
        ? { equipment: appStrings.workout.invalidOptionalField }
        : {}),
      ...(parseDefaultSetCount(defaults.setCount) === null
        ? { setCount: appStrings.workout.invalidDefaultSets }
        : {}),
      ...(parseDefaultRepetitions(defaults.targetReps) === null
        ? { targetReps: appStrings.workout.invalidDefaultRepetitions }
        : {}),
      ...(parseDefaultWeight(defaults.weight) === null
        ? { weight: appStrings.workout.invalidDefaultWeight }
        : {}),
      ...(parseDefaultRestSeconds(defaults.restSeconds) === null
        ? { restSeconds: 'Dinlenme süresi 15–1800 saniye olmalı.' }
        : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !normalizedName) return;
    const parsed = createExerciseDefaultsDraft(
      defaults.setCount,
      defaults.targetReps,
      defaults.weight,
      defaults.weightMode,
      defaults.restSeconds
    );
    if (
      !parsed ||
      normalizedMuscleGroup === null ||
      normalizedEquipment === null
    )
      return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await createWorkoutProgramRepository(database).createCustomExerciseAndAdd(
        dayId,
        {
          ...parsed,
          equipment: normalizedEquipment,
          muscleGroup: normalizedMuscleGroup,
          name: normalizedName,
        }
      );
      AccessibilityInfo.announceForAccessibility(
        appStrings.workout.customExerciseCreated
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

  if (loadingDay) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        <EmptyState
          description={appStrings.workout.loading}
          icon="dumbbell"
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
      scrollViewProps={{ scrollEnabled: !numericGestureActive }}
    >
      <AppButton
        label={appStrings.common.goBack}
        onPress={() => navigateBackOrReplace(router, '/(tabs)/workout')}
        style={styles.backButton}
        variant="ghost"
      />
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="title">
          {appStrings.workout.customExerciseTitle}
        </AppText>
        <AppText selectable tone="muted">
          {appStrings.workout.addExerciseDescription}
        </AppText>
      </View>
      {saveError ? (
        <AppText accessibilityRole="alert" selectable tone="danger">
          {saveError}
        </AppText>
      ) : null}
      <View style={styles.form}>
        <AppTextInput
          error={errors.name}
          label={appStrings.workout.exerciseName}
          maxLength={MAX_EXERCISE_NAME_LENGTH}
          onChangeText={setName}
          placeholder={appStrings.workout.exerciseNamePlaceholder}
          value={name}
        />
        <AppTextInput
          error={errors.muscleGroup}
          label={appStrings.workout.muscleGroup}
          maxLength={120}
          onChangeText={setMuscleGroup}
          placeholder={appStrings.workout.muscleGroupPlaceholder}
          value={muscleGroup}
        />
        <AppTextInput
          error={errors.equipment}
          label={appStrings.workout.equipment}
          maxLength={120}
          onChangeText={setEquipment}
          placeholder={appStrings.workout.equipmentPlaceholder}
          value={equipment}
        />
        <ExerciseDefaultsForm
          errors={errors}
          exerciseName={name || appStrings.workout.customExerciseTitle}
          onChange={setDefaults}
          onGestureActiveChange={setNumericGestureActive}
          values={defaults}
        />
        <AppButton
          disabled={saving}
          label={
            saving
              ? appStrings.workout.saving
              : appStrings.workout.createExercise
          }
          onPress={() => void save()}
        />
      </View>
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
});
