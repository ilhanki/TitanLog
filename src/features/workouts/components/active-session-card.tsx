import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import type { WorkoutSession } from '@/features/workouts/domain/models';
import { formatWorkoutTime } from '@/features/workouts/utils/workout-formatters';
import { calculateSessionMetrics } from '@/features/workouts/utils/workout-values';
import { theme } from '@/theme/tokens';

type ActiveSessionCardProps = {
  onResume: () => void;
  session: WorkoutSession;
};

export function ActiveSessionCard({
  onResume,
  session,
}: ActiveSessionCardProps) {
  const metrics = calculateSessionMetrics(session);
  const totalSets = session.exercises.reduce(
    (count, exercise) => count + exercise.sets.length,
    0
  );

  return (
    <AppCard style={styles.card} tone="accent">
      <AppText tone="primary" variant="label">
        {appStrings.workout.activeSession}
      </AppText>
      <AppText accessibilityRole="header" variant="heading">
        {session.workoutName}
      </AppText>
      <View style={styles.summary}>
        <AppText selectable tone="muted">
          {appStrings.workout.startedAt}: {formatWorkoutTime(session.startedAt)}
        </AppText>
        <AppText selectable tone="muted">
          {metrics.completedSetCount}/{totalSets} {appStrings.workout.sets}
        </AppText>
      </View>
      <AppButton
        icon="play-circle-outline"
        label={appStrings.workout.resumeWorkout}
        onPress={onResume}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.spacing.md },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
});
