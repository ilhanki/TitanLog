import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import type { WorkoutSession } from '@/features/workouts/domain/models';
import { formatWorkoutTime } from '@/features/workouts/utils/workout-formatters';
import { calculateSessionMetrics } from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
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
    <Pressable
      accessibilityHint={`${session.workoutName}, ${metrics.completedSetCount}/${totalSets} ${appStrings.workout.sets}`}
      accessibilityLabel={appStrings.workout.resumeWorkout}
      accessibilityRole="button"
      onPress={onResume}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <AppText tone="primary" variant="label">
          {appStrings.workout.activeSession}
        </AppText>
        <AppText numberOfLines={1} variant="bodyStrong">
          {session.workoutName}
        </AppText>
        <AppText numberOfLines={1} selectable tone="muted" variant="caption">
          {appStrings.workout.startedAt}: {formatWorkoutTime(session.startedAt)}
          {' · '}
          {metrics.completedSetCount}/{totalSets} {appStrings.workout.sets}
        </AppText>
      </View>
      <AppIcon color={theme.colors.primary} name="play-circle-outline" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: theme.spacing.xs },
  pressed: { opacity: 0.78 },
  row: {
    alignItems: 'center',
    backgroundColor: workoutTheme.surfaceActive,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    flexDirection: 'row',
    gap: theme.spacing.md,
    minHeight: theme.layout.touchTarget,
    padding: theme.spacing.md,
  },
});
