import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import type { CompletedWorkoutSummary } from '@/features/workouts/domain/models';
import { formatWorkoutDate } from '@/features/workouts/utils/workout-formatters';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';
import { theme } from '@/theme/tokens';

type LastWorkoutCardProps = {
  onOpen?: () => void;
  workout: CompletedWorkoutSummary | null;
};

export function LastWorkoutCard({ onOpen, workout }: LastWorkoutCardProps) {
  return (
    <AppCard style={styles.card}>
      <AppText accessibilityRole="header" variant="heading">
        {appStrings.home.lastWorkoutTitle}
      </AppText>
      {workout ? (
        <>
          <View style={styles.header}>
            <AppText selectable variant="bodyStrong">
              {workout.workoutName}
            </AppText>
            <AppText selectable tone="primary" variant="caption">
              {formatWorkoutDate(workout.completedAt)}
            </AppText>
          </View>
          <View style={styles.summary}>
            <AppText selectable tone="muted" variant="caption">
              {workout.durationMinutes === null
                ? 'Süre bilgisi yok'
                : `${workout.durationMinutes} dk`}{' '}
              · {workout.completedSetCount} {appStrings.workout.sets}
            </AppText>
            <AppText selectable variant="bodyStrong">
              {formatWorkoutWeight(workout.totalVolume)} kg
            </AppText>
          </View>
          {onOpen ? (
            <AppButton
              accessibilityLabel={`${appStrings.workout.openWorkoutDetails}: ${workout.workoutName}`}
              label={appStrings.workout.viewWorkoutDetails}
              onPress={onOpen}
              variant="secondary"
            />
          ) : null}
        </>
      ) : (
        <AppText selectable tone="muted">
          {appStrings.home.noLastWorkout}
        </AppText>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.spacing.lg },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  summary: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
});
