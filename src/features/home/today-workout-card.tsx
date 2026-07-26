import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { theme } from '@/theme/tokens';

type TodayWorkoutCardProps = {
  actionLabel: string;
  disabled?: boolean;
  onPress: () => void;
  schedule: string;
  title: string;
};

export function TodayWorkoutCard({
  actionLabel,
  disabled,
  onPress,
  schedule,
  title,
}: TodayWorkoutCardProps) {
  return (
    <LinearGradient
      accessibilityLabel={`${appStrings.home.todayWorkoutLabel}: ${title}`}
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
          {title}
        </AppText>
        <AppText selectable tone="muted" variant="bodyStrong">
          {schedule}
        </AppText>
      </View>
      <AppButton disabled={disabled} label={actionLabel} onPress={onPress} />
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
  copy: { gap: theme.spacing.sm, paddingRight: 84 },
});
