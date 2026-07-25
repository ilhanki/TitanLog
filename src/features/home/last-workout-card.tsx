import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import {
  formatTurkishNumber,
  formatWeight,
} from '@/features/home/home-formatters';
import type { HomePreviewData } from '@/features/home/home-preview-data';
import { theme } from '@/theme/tokens';

type LastWorkoutCardProps = {
  workout: HomePreviewData['lastWorkout'];
};

export function LastWorkoutCard({ workout }: LastWorkoutCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="heading">
          {appStrings.home.lastWorkoutTitle}
        </AppText>
        <AppText selectable tone="primary" variant="bodyStrong">
          {workout.dateLabel}
        </AppText>
      </View>
      <View style={styles.exerciseList}>
        {workout.exercises.map((exercise) => (
          <View key={exercise.name} style={styles.exerciseRow}>
            <AppText selectable tone="muted">
              {exercise.name}
            </AppText>
            <AppText selectable variant="bodyStrong">
              {formatWeight(exercise.weight, exercise.weight % 1 === 0 ? 0 : 1)}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.volume}>
        <AppText selectable tone="muted" variant="caption">
          {appStrings.home.totalVolume}
        </AppText>
        <AppText selectable variant="metric">
          {formatTurkishNumber(workout.totalVolume)} kg
        </AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  exerciseList: {
    gap: theme.spacing.md,
  },
  exerciseRow: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.md,
  },
  volume: {
    backgroundColor: theme.colors.backgroundElevated,
    borderRadius: theme.radii.md,
    gap: theme.spacing.xs,
    padding: theme.spacing.lg,
  },
});
