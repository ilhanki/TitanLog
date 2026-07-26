import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { createWorkoutPlanRepository } from '@/features/workouts/data/workout-plan-repository';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';
import type {
  WorkoutDayDetails,
  WorkoutSession,
} from '@/features/workouts/domain/models';
import { formatWorkoutWeekdays } from '@/features/workouts/utils/workout-formatters';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';
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
  const [reloadKey, setReloadKey] = useState(0);

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
    if (!day || starting) return;
    setStarting(true);
    try {
      const session = await createWorkoutSessionRepository(
        database
      ).startSessionFromWorkoutDay(day.id);
      openSession(session.id);
    } catch {
      setError(true);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
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

  if (error) {
    return (
      <Screen edges={['top', 'bottom']}>
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
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          description={appStrings.workout.dayNotFoundDescription}
          icon="alert-circle-outline"
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
    <Screen edges={['top', 'bottom']}>
      <AppButton
        label={appStrings.common.goBack}
        onPress={() => router.back()}
        style={styles.backButton}
        variant="ghost"
      />
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="title">
          {day.name}
        </AppText>
        <AppText selectable tone="primary" variant="bodyStrong">
          {formatWorkoutWeekdays(day.scheduleWeekdays)}
        </AppText>
        <AppText selectable tone="muted">
          {day.exerciseCount} {appStrings.workout.exercises} · {day.subtitle}
        </AppText>
      </View>

      {activeSession ? (
        <AppCard style={styles.notice} tone="accent">
          <AppText variant="bodyStrong">
            {appStrings.workout.activeSession}
          </AppText>
          <AppText selectable tone="muted">
            {appStrings.workout.activeSessionNotice}
          </AppText>
          <AppButton
            label={appStrings.workout.backToActive}
            onPress={() => openSession(activeSession.id)}
          />
        </AppCard>
      ) : (
        <AppButton
          disabled={starting}
          label={appStrings.workout.startWorkout}
          onPress={() => void startWorkout()}
        />
      )}

      <View style={styles.exerciseList}>
        {day.exercises.map((exercise) => (
          <AppCard key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <AppText variant="bodyStrong">{exercise.name}</AppText>
              <AppText tone="subtle" variant="caption">
                {exercise.muscleGroup}
              </AppText>
            </View>
            <AppText selectable tone="muted">
              {exercise.setCount} × {exercise.targetReps} ·{' '}
              {formatWorkoutWeight(exercise.weightKg)} kg
              {exercise.weightMode === 'per_hand'
                ? ` (${appStrings.workout.perHand})`
                : ''}
            </AppText>
          </AppCard>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start' },
  exerciseCard: { gap: theme.spacing.sm },
  exerciseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  exerciseList: { gap: theme.spacing.md },
  header: { gap: theme.spacing.sm },
  notice: { gap: theme.spacing.md },
});
