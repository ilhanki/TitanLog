import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { createWorkoutPlanRepository } from '@/features/workouts/data/workout-plan-repository';
import {
  createWorkoutSessionRepository,
  WorkoutSessionError,
} from '@/features/workouts/data/workout-session-repository';
import type {
  WorkoutDayDetails,
  WorkoutSession,
} from '@/features/workouts/domain/models';
import { formatWorkoutWeekdays } from '@/features/workouts/utils/workout-formatters';
import { navigateBackOrReplace } from '@/navigation/safe-navigation';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

export function WorkoutDayScreen() {
  const { dayId: rawDayId } = useLocalSearchParams<{ dayId: string }>();
  const dayId = Number(rawDayId);
  const database = useSQLiteContext();
  const router = useRouter();
  const [day, setDay] = useState<WorkoutDayDetails | null>(null);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const startingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setLoading(true);
      setError(false);
      if (!Number.isSafeInteger(dayId) || dayId <= 0) {
        setDay(null);
        setLoading(false);
        return () => {
          active = false;
        };
      }
      void Promise.all([
        createWorkoutPlanRepository(database).getWorkoutDayDetails(dayId),
        createWorkoutSessionRepository(database).getActiveSession(),
      ])
        .then(([nextDay, session]) => {
          if (active) {
            setDay(nextDay);
            setActiveSession(session);
          }
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [database, dayId, reloadKey])
  );

  const openSession = (sessionId: number) =>
    router.replace(`/workout/session/${sessionId}` as Href);

  const startWorkout = async () => {
    if (!day || day.exercises.length === 0 || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const session = await createWorkoutSessionRepository(
        database
      ).startSessionFromWorkoutDay(day.id);
      openSession(session.id);
    } catch (caught) {
      setStartError(
        caught instanceof WorkoutSessionError &&
          caught.code === 'day_has_no_exercises'
          ? appStrings.workout.noExercisesStart
          : appStrings.workout.writeError
      );
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  if (loading) {
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

  if (error) {
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

  if (!day) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        <EmptyState
          description={appStrings.workout.dayNotFoundDescription}
          icon="alert-circle-outline"
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
    <Screen backgroundColor={workoutTheme.background} edges={['top', 'bottom']}>
      <AppButton
        label={appStrings.common.goBack}
        onPress={() => navigateBackOrReplace(router, '/(tabs)/workout')}
        style={styles.backButton}
        variant="ghost"
      />
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="title">
          {day.name}
        </AppText>
        <AppText selectable tone="muted" variant="caption">
          {formatWorkoutWeekdays(day.scheduleWeekdays)} · {day.exerciseCount}{' '}
          {appStrings.workout.exercises} · {day.totalSetCount}{' '}
          {appStrings.workout.sets}
        </AppText>
      </View>

      {startError ? (
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          tone="danger"
        >
          {startError}
        </AppText>
      ) : null}

      {activeSession ? (
        <View style={styles.activeNotice}>
          <View style={styles.noticeCopy}>
            <AppText variant="bodyStrong">
              {appStrings.workout.activeSession}
            </AppText>
            <AppText
              numberOfLines={1}
              selectable
              tone="muted"
              variant="caption"
            >
              {appStrings.workout.activeSessionNotice}
            </AppText>
          </View>
          <AppButton
            label={appStrings.workout.backToActive}
            onPress={() => openSession(activeSession.id)}
          />
        </View>
      ) : day.exercises.length > 0 ? (
        <AppButton
          disabled={starting}
          label={appStrings.workout.startWorkout}
          onPress={() => void startWorkout()}
        />
      ) : (
        <EmptyState
          description={appStrings.workout.noExercisesStart}
          icon="dumbbell"
          title={appStrings.workout.noProgramExercisesTitle}
        />
      )}

      <View style={styles.exerciseList}>
        {day.exercises.map((exercise) => (
          <Pressable
            accessibilityLabel={`${exercise.name} geçmişini aç. ${exercise.setCount} ${appStrings.workout.sets}, ${exercise.targetReps} ${appStrings.workout.repetitions}, ${formatWorkoutWeight(exercise.weightKg)} kg${exercise.weightMode === 'per_hand' ? `, ${appStrings.workout.perHand}` : ''}`}
            accessibilityRole="button"
            key={exercise.id}
            onPress={() =>
              router.push(`/workout/exercise/${exercise.id}/history` as Href)
            }
            style={styles.exerciseRow}
          >
            <AppText
              numberOfLines={1}
              style={styles.exerciseName}
              variant="bodyStrong"
            >
              {exercise.name}
              {exercise.weightMode === 'per_hand' ? ' · el' : ''}
            </AppText>
            <AppText style={styles.setMetric} tone="muted" variant="caption">
              {exercise.setCount} set
            </AppText>
            <AppText
              style={styles.repetitionMetric}
              tone="muted"
              variant="caption"
            >
              {exercise.targetReps} tk
            </AppText>
            <AppText style={styles.weightMetric} tone="muted" variant="caption">
              {formatWorkoutWeight(exercise.weightKg)} kg
            </AppText>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  activeNotice: {
    alignItems: 'center',
    backgroundColor: workoutTheme.surfaceActive,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  backButton: { alignSelf: 'flex-start' },
  exerciseList: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    overflow: 'hidden',
  },
  exerciseName: { flex: 1 },
  exerciseRow: {
    alignItems: 'center',
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: theme.layout.touchTarget,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  header: { gap: theme.spacing.xs },
  noticeCopy: { flex: 1, gap: theme.spacing.xs },
  repetitionMetric: { fontVariant: ['tabular-nums'], width: 44 },
  setMetric: { fontVariant: ['tabular-nums'], width: 48 },
  weightMetric: { fontVariant: ['tabular-nums'], width: 60 },
});
