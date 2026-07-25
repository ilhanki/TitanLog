import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ProgressBar } from '@/components/progress-bar';
import { appStrings } from '@/constants/strings';
import { calculateGoalProgress } from '@/features/home/calculate-goal-progress';
import { formatProgress, formatWeight } from '@/features/home/home-formatters';
import type { HomePreviewData } from '@/features/home/home-preview-data';
import { theme } from '@/theme/tokens';

type GoalCardProps = {
  goal: HomePreviewData['goal'];
};

export function GoalCard({ goal }: GoalCardProps) {
  const progress = calculateGoalProgress(
    goal.startingWeight,
    goal.currentWeight,
    goal.targetWeight
  );
  const remainingWeight = Math.max(goal.currentWeight - goal.targetWeight, 0);
  const progressLabel = `${formatProgress(progress)} ${appStrings.home.goalCompleted}`;

  const values = [
    {
      label: appStrings.home.startingWeight,
      value: formatWeight(goal.startingWeight),
    },
    {
      label: appStrings.home.currentWeight,
      value: formatWeight(goal.currentWeight),
    },
    {
      label: appStrings.home.targetWeight,
      value: formatWeight(goal.targetWeight),
    },
    {
      label: appStrings.home.remainingWeight,
      value: formatWeight(remainingWeight),
    },
  ];

  return (
    <AppCard style={styles.card} tone="raised">
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="heading">
          {appStrings.home.goalTitle}
        </AppText>
        <AppText selectable tone="primary" variant="bodyStrong">
          {progressLabel}
        </AppText>
      </View>
      <ProgressBar
        accessibilityLabel={`${appStrings.home.goalTitle}: ${progressLabel}`}
        progress={progress}
      />
      <View style={styles.values}>
        {values.map((item) => (
          <View key={item.label} style={styles.valueItem}>
            <AppText selectable tone="muted" variant="caption">
              {item.label}
            </AppText>
            <AppText selectable variant="bodyStrong">
              {item.value}
            </AppText>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.lg,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  values: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  valueItem: {
    backgroundColor: theme.colors.backgroundElevated,
    borderRadius: theme.radii.md,
    flexBasis: 130,
    flexGrow: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
});
