import { useRouter } from 'expo-router';
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
import { theme } from '@/theme/tokens';

export function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < theme.layout.compactWidth;
  const stats = [
    {
      icon: 'calendar-check-outline' as const,
      label: appStrings.home.sportsDays,
      value: formatTurkishNumber(homePreviewData.stats.sportsDays),
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
      icon: 'fire' as const,
      label: appStrings.home.streak,
      value: `${formatTurkishNumber(homePreviewData.stats.streakDays)} ${appStrings.home.dayUnit}`,
    },
  ];

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
      <TodayWorkoutCard workout={homePreviewData.todayWorkout} />
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
      <LastWorkoutCard workout={homePreviewData.lastWorkout} />
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
