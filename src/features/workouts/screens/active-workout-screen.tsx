import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { WorkoutSetRow } from '@/features/workouts/components/workout-set-row';
import {
  createWorkoutSessionRepository,
  WorkoutSessionError,
} from '@/features/workouts/data/workout-session-repository';
import type { WorkoutSession } from '@/features/workouts/domain/models';
import { formatWorkoutTime } from '@/features/workouts/utils/workout-formatters';
import { calculateSessionMetrics } from '@/features/workouts/utils/workout-values';
import { theme } from '@/theme/tokens';

export function ActiveWorkoutScreen() {
  const { sessionId: rawSessionId } = useLocalSearchParams<{
    sessionId: string;
  }>();
  const sessionId = Number(rawSessionId);
  const database = useSQLiteContext();
  const repository = createWorkoutSessionRepository(database);
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((value) => value + 1);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setLoading(true);
      setError(null);
      if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
        setSession(null);
        setLoading(false);
        return () => {
          active = false;
        };
      }
      void createWorkoutSessionRepository(database)
        .getSessionDetails(sessionId)
        .then((nextSession) => {
          if (active) setSession(nextSession);
        })
        .catch(() => {
          if (active) setError(appStrings.workout.loadError);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [database, reloadKey, sessionId])
  );

  const runWrite = async (key: string, operation: () => Promise<void>) => {
    if (pendingKey) return;
    setPendingKey(key);
    setError(null);
    try {
      await operation();
      reload();
    } catch (caught) {
      if (
        caught instanceof WorkoutSessionError &&
        caught.code === 'no_completed_sets'
      ) {
        setError(appStrings.workout.noCompletedSets);
      } else if (
        caught instanceof WorkoutSessionError &&
        caught.code === 'invalid_set'
      ) {
        setError(appStrings.workout.invalidSet);
      } else {
        setError(appStrings.workout.writeError);
      }
    } finally {
      setPendingKey(null);
    }
  };

  const finish = () => {
    Alert.alert(
      appStrings.workout.finishTitle,
      appStrings.workout.finishDescription,
      [
        { style: 'cancel', text: appStrings.workout.keepWorkout },
        {
          text: appStrings.workout.finishConfirm,
          onPress: () =>
            void runWrite('finish', async () => {
              await repository.completeSession(sessionId);
              router.replace(`/workout/session/${sessionId}/summary` as Href);
            }),
        },
      ]
    );
  };

  const cancel = () => {
    Alert.alert(
      appStrings.workout.cancelTitle,
      appStrings.workout.cancelDescription,
      [
        { style: 'cancel', text: appStrings.workout.keepWorkout },
        {
          style: 'destructive',
          text: appStrings.workout.cancelConfirm,
          onPress: () =>
            void runWrite('cancel', async () => {
              await repository.cancelSession(sessionId);
              router.replace('/workout');
            }),
        },
      ]
    );
  };

  useEffect(() => {
    if (session?.status === 'completed') {
      router.replace(`/workout/session/${sessionId}/summary` as Href);
    }
  }, [router, session?.status, sessionId]);

  if (loading || session?.status === 'completed') {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          description={appStrings.workout.loading}
          icon="dumbbell"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          description={appStrings.workout.sessionNotFoundDescription}
          icon="alert-circle-outline"
          title={appStrings.workout.sessionNotFound}
        />
        <AppButton
          label={appStrings.common.goBack}
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  const metrics = calculateSessionMetrics(session);
  const totalSets = session.exercises.reduce(
    (count, exercise) => count + exercise.sets.length,
    0
  );

  return (
    <Screen edges={['top', 'bottom']} keyboardAware>
      <AppButton
        label={appStrings.common.goBack}
        onPress={() => router.back()}
        style={styles.backButton}
        variant="ghost"
      />
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="title">
          {session.workoutName}
        </AppText>
        <AppText selectable tone="muted">
          {appStrings.workout.startedAt}: {formatWorkoutTime(session.startedAt)}
        </AppText>
        <AppText selectable tone="primary" variant="bodyStrong">
          {appStrings.workout.completedSets}: {metrics.completedSetCount}/
          {totalSets}
        </AppText>
      </View>

      {error ? (
        <AppText accessibilityLiveRegion="polite" selectable tone="danger">
          {error}
        </AppText>
      ) : null}

      <View style={styles.exercises}>
        {session.exercises.map((exercise) => (
          <AppCard key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <AppText variant="heading">{exercise.name}</AppText>
              <AppText tone="muted" variant="caption">
                {exercise.weightMode === 'per_hand'
                  ? appStrings.workout.perHand
                  : exercise.muscleGroup}
              </AppText>
            </View>
            {exercise.sets.map((workoutSet) => (
              <WorkoutSetRow
                disabled={pendingKey !== null}
                key={workoutSet.id}
                onSave={(weightKg, actualReps) =>
                  runWrite(`set-${workoutSet.id}`, () =>
                    repository.updateSetValues(
                      workoutSet.id,
                      weightKg,
                      actualReps
                    )
                  )
                }
                onToggle={(weightKg, actualReps) =>
                  runWrite(`toggle-${workoutSet.id}`, async () => {
                    await repository.updateSetValues(
                      workoutSet.id,
                      weightKg,
                      actualReps
                    );
                    await repository.toggleSetCompletion(workoutSet.id);
                  })
                }
                workoutSet={workoutSet}
              />
            ))}
            <View style={styles.setActions}>
              <AppButton
                disabled={pendingKey !== null}
                label={appStrings.workout.addSet}
                onPress={() =>
                  void runWrite(`add-${exercise.id}`, () =>
                    repository.addSet(exercise.id)
                  )
                }
                style={styles.setAction}
                variant="secondary"
              />
              <AppButton
                disabled={pendingKey !== null || exercise.sets.length <= 1}
                label={appStrings.workout.removeSet}
                onPress={() =>
                  void runWrite(`remove-${exercise.id}`, () =>
                    repository.removeLastIncompleteSet(exercise.id)
                  )
                }
                style={styles.setAction}
                variant="ghost"
              />
            </View>
          </AppCard>
        ))}
      </View>

      <AppButton
        disabled={pendingKey !== null}
        label={appStrings.workout.finishWorkout}
        onPress={finish}
      />
      <AppButton
        disabled={pendingKey !== null}
        label={appStrings.workout.cancelWorkout}
        onPress={cancel}
        variant="ghost"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start' },
  exerciseCard: { gap: theme.spacing.lg },
  exerciseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  exercises: { gap: theme.spacing.lg },
  header: { gap: theme.spacing.sm },
  setAction: { flexGrow: 1 },
  setActions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
});
