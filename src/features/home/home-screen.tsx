import { useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatCard } from '@/components/stat-card';
import { appStrings } from '@/constants/strings';
import { AuthEntryCard } from '@/features/home/auth-entry-card';
import {
  formatTurkishNumber,
  formatWeight,
} from '@/features/home/home-formatters';
import { homePreviewData } from '@/features/home/home-preview-data';
import { GoalCard } from '@/features/home/goal-card';
import { LastWorkoutCard } from '@/features/home/last-workout-card';
import { MotivationBanner } from '@/features/home/motivation-banner';
import { TodayWorkoutCard } from '@/features/home/today-workout-card';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';
import { useWorkoutOverview } from '@/features/workouts/hooks/use-workout-overview';
import { formatWorkoutWeekdays } from '@/features/workouts/utils/workout-formatters';
import { decideWorkoutStart } from '@/features/workouts/utils/workout-navigation';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';
import { theme } from '@/theme/tokens';

export function HomeScreen() {
  const database = useSQLiteContext();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < theme.layout.compactWidth;
  const { data, error, loading, retry } = useWorkoutOverview();
  const [starting, setStarting] = useState(false);
  const latestWorkout = data.recentSessions[0] ?? null;
  const stats = [
    {
      icon: 'calendar-check-outline' as const,
      label: appStrings.home.sportsDays,
      value: formatTurkishNumber(data.completedSessionCount),
    },
    {
      icon: 'scale-bathroom' as const,
      label: appStrings.home.currentWeight,
      value: formatWeight(homePreviewData.stats.currentWeight),
    },
    {
      icon: 'target' as const,
      label: appStrings.home.target,
      value: formatWeight(homePreviewData.stats.targetWeight),
    },
    {
      icon: 'weight-lifter' as const,
      label: appStrings.home.latestVolume,
      value: `${formatWorkoutWeight(latestWorkout?.totalVolume ?? 0)} kg`,
    },
  ];

  const handleWorkoutAction = async () => {
    if (error) {
      retry();
      return;
    }
    const decision = decideWorkoutStart(
      data.activeSession,
      data.scheduledWorkout
    );
    if (decision.kind === 'resume') {
      router.navigate(`/workout/session/${decision.sessionId}` as Href);
      return;
    }
    if (decision.kind === 'rest') {
      router.navigate('/workout');
      return;
    }
    if (starting) return;
    setStarting(true);
    try {
      const session = await createWorkoutSessionRepository(
        database
      ).startSessionFromWorkoutDay(decision.dayId);
      router.navigate(`/workout/session/${session.id}` as Href);
    } catch {
      router.navigate('/workout');
    } finally {
      setStarting(false);
    }
  };

  const workoutTitle = loading
    ? appStrings.database.loadingTitle
    : error
      ? appStrings.database.errorTitle
      : (data.activeSession?.workoutName ??
        data.scheduledWorkout?.name ??
        appStrings.workout.restTitle);
  const workoutSchedule = loading
    ? appStrings.workout.loading
    : error
      ? appStrings.workout.loadError
      : data.activeSession
        ? appStrings.workout.activeSessionNotice
        : data.scheduledWorkout
          ? formatWorkoutWeekdays(data.scheduledWorkout.scheduleWeekdays)
          : appStrings.workout.restDescription;
  const workoutAction = error
    ? appStrings.workout.retry
    : data.activeSession
      ? appStrings.workout.resumeWorkout
      : data.scheduledWorkout
        ? appStrings.home.startWorkout
        : appStrings.workout.viewProgram;

  return (
    <Screen>
      <AppHeader
        actionIcon="account-outline"
        actionLabel={appStrings.home.openProfile}
        brand={appStrings.brandName}
        onActionPress={() => router.navigate('/profile')}
      />
      <View style={styles.welcome}>
        <AppText accessibilityRole="header" variant="display">
          {appStrings.home.welcomeTitle}
        </AppText>
        <AppText selectable tone="muted">
          {appStrings.home.welcomeSubtitle}
        </AppText>
      </View>
      <AuthEntryCard compact={compact} />
      <TodayWorkoutCard
        actionLabel={workoutAction}
        disabled={loading || starting}
        onPress={() => void handleWorkoutAction()}
        schedule={workoutSchedule}
        title={workoutTitle}
      />
      <View style={styles.section}>
        <SectionHeader title={appStrings.home.overviewTitle} />
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <StatCard
              icon={stat.icon}
              key={stat.label}
              label={stat.label}
              style={[styles.statCard, compact && styles.compactStatCard]}
              value={stat.value}
            />
          ))}
        </View>
      </View>
      <GoalCard goal={homePreviewData.goal} />
      <LastWorkoutCard workout={latestWorkout} />
      <MotivationBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: {
    gap: theme.spacing.sm,
  },
  section: {
    gap: theme.spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  statCard: {
    flexBasis: '46%',
    flexGrow: 1,
  },
  compactStatCard: {
    flexBasis: '100%',
  },
});
