import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import type { HomePreviewData } from '@/features/home/home-preview-data';
import { theme } from '@/theme/tokens';

type TodayWorkoutCardProps = {
  workout: HomePreviewData['todayWorkout'];
};

export function TodayWorkoutCard({ workout }: TodayWorkoutCardProps) {
  const router = useRouter();

  return (
    <LinearGradient
      accessibilityLabel={`${appStrings.home.todayWorkoutLabel}: ${workout.title}`}
      colors={[theme.colors.surfaceRaised, theme.colors.primarySoft]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.card}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.emblem}
      >
        <AppIcon
          color={theme.colors.accent}
          name="shield-star-outline"
          size={theme.iconSizes.hero}
        />
      </View>
      <View style={styles.copy}>
        <AppText tone="primary" variant="label">
          {appStrings.home.todayWorkoutLabel}
        </AppText>
        <AppText accessibilityRole="header" variant="title">
          {workout.title}
        </AppText>
        <AppText selectable tone="muted" variant="bodyStrong">
          {workout.schedule}
        </AppText>
      </View>
      <AppButton
        icon="arrow-right"
        label={appStrings.home.startWorkout}
        onPress={() => router.navigate('/workout')}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: theme.colors.borderStrong,
    borderCurve: 'continuous',
    borderRadius: theme.radii.xl,
    borderWidth: theme.borders.thin,
    boxShadow: theme.shadows.accent,
    gap: theme.spacing.xxl,
    overflow: 'hidden',
    padding: theme.spacing.xxl,
  },
  emblem: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    height: 72,
    justifyContent: 'center',
    position: 'absolute',
    right: theme.spacing.xxl,
    top: theme.spacing.xxl,
    width: 72,
  },
  copy: {
    gap: theme.spacing.sm,
    paddingRight: 84,
  },
});
