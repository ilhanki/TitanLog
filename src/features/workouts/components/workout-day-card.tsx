import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import type { WorkoutDay } from '@/features/workouts/domain/models';
import { formatWorkoutWeekdays } from '@/features/workouts/utils/workout-formatters';
import { theme } from '@/theme/tokens';

type WorkoutDayCardProps = {
  day: WorkoutDay;
  onOpen: () => void;
};

export function WorkoutDayCard({ day, onOpen }: WorkoutDayCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.copy}>
        <AppText accessibilityRole="header" variant="heading">
          {day.name}
        </AppText>
        <AppText selectable tone="primary" variant="bodyStrong">
          {formatWorkoutWeekdays(day.scheduleWeekdays)}
        </AppText>
        <AppText selectable tone="muted">
          {day.exerciseCount} {appStrings.workout.exercises} ·{' '}
          {day.exercisePreview.join(', ')}
        </AppText>
      </View>
      <AppButton
        label={appStrings.workout.viewProgram}
        onPress={onOpen}
        variant="secondary"
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.lg,
  },
  copy: {
    gap: theme.spacing.sm,
  },
});
