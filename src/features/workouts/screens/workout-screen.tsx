import { useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { appStrings } from '@/constants/strings';
import { ActiveSessionCard } from '@/features/workouts/components/active-session-card';
import { CompletedWorkoutRow } from '@/features/workouts/components/completed-workout-row';
import { WorkoutDayCard } from '@/features/workouts/components/workout-day-card';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';
import type { WorkoutDay } from '@/features/workouts/domain/models';
import { useWorkoutOverview } from '@/features/workouts/hooks/use-workout-overview';
import { formatWorkoutWeekdays } from '@/features/workouts/utils/workout-formatters';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type WorkoutScreenProps = { now?: Date };

export function WorkoutScreen({ now }: WorkoutScreenProps) {
  const database = useSQLiteContext();
  const router = useRouter();
  const { data, error, loading, retry } = useWorkoutOverview(now);
  const [starting, setStarting] = useState(false);
  const [writeError, setWriteError] = useState(false);
  const startingRef = useRef(false);

  const openDay = (day: WorkoutDay) => {
    router.push(`/workout/day/${day.id}` as Href);
  };
  const resume = (sessionId: number) => {
    router.push(`/workout/session/${sessionId}` as Href);
  };
  const openHistory = () => {
    router.push('/workout/history' as Href);
  };
  const openProgram = () => {
    router.push('/workout/program' as Href);
  };
  const openCompletedWorkout = (sessionId: number) => {
    router.push(`/workout/history/${sessionId}` as Href);
  };
  const start = async (dayId: number) => {
    if (startingRef.current) return;
    startingRef.current = true;
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
      startingRef.current = false;
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Screen backgroundColor={workoutTheme.background}>
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
      <Screen backgroundColor={workoutTheme.background}>
        <EmptyState
          description={appStrings.workout.loadError}
          icon="alert-circle-outline"
          title={appStrings.database.errorTitle}
        />
        <AppButton label={appStrings.workout.retry} onPress={retry} />
      </Screen>
    );
  }

  const scheduled = data.scheduledWorkout;

  return (
    <Screen backgroundColor={workoutTheme.background}>
      <AppText accessibilityRole="header" variant="title">
        {appStrings.workout.title}
      </AppText>

      {writeError ? (
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          selectable
          tone="danger"
        >
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
        {scheduled ? (
          <View style={styles.todayRow}>
            <Pressable
              accessibilityLabel={`${appStrings.workout.viewProgram}: ${scheduled.name}`}
              accessibilityRole="button"
              onPress={() => openDay(scheduled)}
              style={styles.todayCopy}
            >
              <AppText numberOfLines={1} variant="bodyStrong">
                {scheduled.name}
              </AppText>
              <AppText
                numberOfLines={1}
                selectable
                tone="muted"
                variant="caption"
              >
                {formatWorkoutWeekdays(scheduled.scheduleWeekdays)} ·{' '}
                {scheduled.exerciseCount} {appStrings.workout.exercises} ·{' '}
                {scheduled.totalSetCount} {appStrings.workout.sets}
              </AppText>
            </Pressable>
            <AppButton
              disabled={starting || Boolean(data.activeSession)}
              icon="play-outline"
              label={appStrings.workout.startWorkout}
              onPress={() => void start(scheduled.id)}
              style={styles.todayAction}
            />
          </View>
        ) : (
          <EmptyState
            description={appStrings.workout.restDescription}
            icon="weather-sunset"
            title={appStrings.workout.restTitle}
          />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          actionLabel={appStrings.workout.editProgram}
          onActionPress={openProgram}
          title={appStrings.workout.myProgram}
        />
        <View style={styles.flatList}>
          {data.plan?.days.map((day) => (
            <WorkoutDayCard
              day={day}
              key={day.id}
              onOpen={() => openDay(day)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          actionLabel={appStrings.workout.viewAllHistory}
          onActionPress={openHistory}
          title={appStrings.workout.recentWorkouts}
        />
        {data.recentSessions.length === 0 ? (
          <EmptyState
            description={appStrings.workout.noHistoryDescription}
            icon="history"
            title={appStrings.workout.noHistoryTitle}
          />
        ) : (
          <View style={styles.flatList}>
            {data.recentSessions.map((session) => (
              <CompletedWorkoutRow
                key={session.id}
                onPress={() => openCompletedWorkout(session.id)}
                workout={session}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flatList: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    overflow: 'hidden',
  },
  section: { gap: theme.spacing.md },
  todayAction: { flexShrink: 0, minHeight: theme.layout.compactTouchTarget },
  todayCopy: {
    flex: 1,
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  todayRow: {
    alignItems: 'center',
    backgroundColor: workoutTheme.surfaceActive,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
});
