import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import type { WorkoutDay } from '@/features/workouts/domain/models';
import { formatWorkoutWeekdays } from '@/features/workouts/utils/workout-formatters';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type WorkoutDayCardProps = {
  day: WorkoutDay;
  onOpen: () => void;
};

export function WorkoutDayCard({ day, onOpen }: WorkoutDayCardProps) {
  const weekdays = formatWorkoutWeekdays(day.scheduleWeekdays);
  return (
    <Pressable
      accessibilityLabel={`${day.name}, ${weekdays}, ${day.exerciseCount} ${appStrings.workout.exercises}, ${day.totalSetCount} ${appStrings.workout.sets}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <AppText numberOfLines={1} variant="bodyStrong">
          {day.name}
        </AppText>
        <AppText numberOfLines={1} selectable tone="muted" variant="caption">
          {weekdays} · {day.exerciseCount} {appStrings.workout.exercises} ·{' '}
          {day.totalSetCount} {appStrings.workout.sets}
        </AppText>
        <AppText numberOfLines={1} selectable tone="subtle" variant="caption">
          {day.exercisePreview.join(', ')}
        </AppText>
      </View>
      <AppIcon name="chevron-right" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: theme.spacing.xs },
  pressed: { backgroundColor: workoutTheme.surfaceActive },
  row: {
    alignItems: 'center',
    backgroundColor: workoutTheme.surface,
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.md,
    minHeight: theme.layout.touchTarget,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
});
