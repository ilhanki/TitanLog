import { useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { appStrings } from '@/constants/strings';
import { ActiveSessionCard } from '@/features/workouts/components/active-session-card';
import { WorkoutDayCard } from '@/features/workouts/components/workout-day-card';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';
import type { WorkoutDay } from '@/features/workouts/domain/models';
import { useWorkoutOverview } from '@/features/workouts/hooks/use-workout-overview';
import {
  formatWorkoutDate,
  formatWorkoutWeekdays,
} from '@/features/workouts/utils/workout-formatters';
import { theme } from '@/theme/tokens';

type WorkoutScreenProps = { now?: Date };

export function WorkoutScreen({ now }: WorkoutScreenProps) {
  const database = useSQLiteContext();
  const router = useRouter();
  const { data, error, loading, retry } = useWorkoutOverview(now);
  const [starting, setStarting] = useState(false);
  const [writeError, setWriteError] = useState(false);

  const openDay = (day: WorkoutDay) => {
    router.push(`/workout/day/${day.id}` as Href);
  };
  const resume = (sessionId: number) => {
    router.push(`/workout/session/${sessionId}` as Href);
  };
  const start = async (dayId: number) => {
    if (starting) return;
    setStarting(true);
    setWriteError(false);
    try {
      const session =
        await createWorkoutSessionRepository(
          database
        ).startSessionFromWorkoutDay(dayId);
      resume(session.id);
    } catch {
      setWriteError(true);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppText accessibilityRole="header" variant="title">
          {appStrings.workout.title}
        </AppText>
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
      <Screen>
        <EmptyState
          description={appStrings.workout.loadError}
          icon="alert-circle-outline"
          title={appStrings.database.errorTitle}
        />
        <AppButton label={appStrings.workout.retry} onPress={retry} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText accessibilityRole="header" variant="title">
        {appStrings.workout.title}
      </AppText>

      {writeError ? (
        <AppText accessibilityLiveRegion="polite" selectable tone="danger">
          {appStrings.workout.writeError}
        </AppText>
      ) : null}

      {data.activeSession ? (
        <ActiveSessionCard
          onResume={() => resume(data.activeSession!.id)}
          session={data.activeSession}
        />
      ) : null}

      <View style={styles.section}>
        <SectionHeader title={appStrings.workout.todayWorkout} />
        {data.scheduledWorkout ? (
          <AppCard style={styles.card} tone="raised">
            <AppText accessibilityRole="header" variant="heading">
              {data.scheduledWorkout.name}
            </AppText>
            <AppText selectable tone="primary" variant="bodyStrong">
              {formatWorkoutWeekdays(data.scheduledWorkout.scheduleWeekdays)}
            </AppText>
            <AppText selectable tone="muted">
              {data.scheduledWorkout.exerciseCount}{' '}
              {appStrings.workout.exercises}
            </AppText>
            <View style={styles.actions}>
              <AppButton
                label={appStrings.workout.viewProgram}
                onPress={() => openDay(data.scheduledWorkout!)}
                style={styles.action}
                variant="secondary"
              />
              <AppButton
                disabled={starting || Boolean(data.activeSession)}
                label={appStrings.workout.startWorkout}
                onPress={() => void start(data.scheduledWorkout!.id)}
                style={styles.action}
              />
            </View>
          </AppCard>
        ) : (
          <EmptyState
            description={appStrings.workout.restDescription}
            icon="weather-sunset"
            title={appStrings.workout.restTitle}
          />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title={appStrings.workout.myProgram} />
        {data.plan?.days.map((day) => (
          <WorkoutDayCard day={day} key={day.id} onOpen={() => openDay(day)} />
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title={appStrings.workout.recentWorkouts} />
        {data.recentSessions.length === 0 ? (
          <EmptyState
            description={appStrings.workout.noHistoryDescription}
            icon="history"
            title={appStrings.workout.noHistoryTitle}
          />
        ) : (
          data.recentSessions.map((session) => (
            <AppCard key={session.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <AppText variant="bodyStrong">{session.workoutName}</AppText>
                <AppText tone="primary" variant="caption">
                  {formatWorkoutDate(session.completedAt)}
                </AppText>
              </View>
              <AppText selectable tone="muted">
                {session.completedSetCount} {appStrings.workout.sets} ·{' '}
                {session.totalRepetitions} {appStrings.workout.repetitions}
              </AppText>
            </AppCard>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { flexGrow: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  card: { gap: theme.spacing.md },
  historyCard: { gap: theme.spacing.sm },
  historyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  section: { gap: theme.spacing.lg },
});
