import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import type { CompletedWorkoutHistoryItem } from '@/features/workouts/domain/models';
import {
  formatWorkoutDate,
  formatWorkoutDuration,
} from '@/features/workouts/utils/workout-formatters';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type CompletedWorkoutRowProps = {
  onPress: () => void;
  workout: CompletedWorkoutHistoryItem;
};

export function CompletedWorkoutRow({
  onPress,
  workout,
}: CompletedWorkoutRowProps) {
  const description = `${workout.completedSetCount} ${appStrings.workout.sets} · ${formatWorkoutWeight(workout.totalVolume)} kg · ${formatWorkoutDuration(workout.durationMinutes)}`;
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={`${appStrings.workout.openWorkoutDetails}: ${workout.workoutName}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <AppText numberOfLines={1} variant="bodyStrong">
          {workout.workoutName}
        </AppText>
        <AppText selectable tone="muted" variant="caption">
          {formatWorkoutDate(workout.completedAt)}
        </AppText>
        <AppText selectable tone="subtle" variant="caption">
          {description}
        </AppText>
      </View>
      <AppIcon name="chevron-right" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: theme.spacing.xs, minWidth: 0 },
  pressed: { backgroundColor: workoutTheme.surfaceActive },
  row: {
    alignItems: 'center',
    backgroundColor: workoutTheme.surface,
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minHeight: theme.layout.touchTarget,
    padding: theme.spacing.md,
  },
});
