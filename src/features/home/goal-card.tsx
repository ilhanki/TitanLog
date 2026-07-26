import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ProgressBar } from '@/components/progress-bar';
import { appStrings } from '@/constants/strings';
import type { BodyProfile, BodyProgress } from '@/features/body/domain/models';
import { formatBodyValue } from '@/features/body/utils/body-values';
import { theme } from '@/theme/tokens';

type GoalCardProps = {
  profile: BodyProfile;
  progress: BodyProgress;
};

export function GoalCard({ profile, progress }: GoalCardProps) {
  const progressLabel = `%${progress.progressPercentage} ${appStrings.home.goalCompleted}`;
  const values = [
    {
      label: appStrings.home.startingWeight,
      value: profile.startingWeightKg,
    },
    {
      label: appStrings.home.currentWeight,
      value: progress.currentWeightKg,
    },
    { label: appStrings.home.targetWeight, value: profile.targetWeightKg },
    {
      label: appStrings.home.remainingWeight,
      value: progress.remainingWeightKg,
    },
  ];

  return (
    <AppCard style={styles.card} tone="raised">
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="heading">
          {appStrings.home.goalTitle}
        </AppText>
        <AppText selectable tone="primary" variant="bodyStrong">
          {progress.targetReached ? appStrings.progress.reached : progressLabel}
        </AppText>
      </View>
      <ProgressBar
        accessibilityLabel={`${appStrings.home.goalTitle}: ${progressLabel}`}
        progress={progress.progress}
      />
      <View style={styles.values}>
        {values.map((item) => (
          <View key={item.label} style={styles.valueItem}>
            <AppText selectable tone="muted" variant="caption">
              {item.label}
            </AppText>
            <AppText selectable variant="bodyStrong">
              {formatBodyValue(item.value)} kg
            </AppText>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.spacing.lg },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  valueItem: {
    backgroundColor: theme.colors.backgroundElevated,
    borderRadius: theme.radii.md,
    flexBasis: 130,
    flexGrow: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  values: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
});
