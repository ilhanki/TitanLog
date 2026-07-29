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
    <View
      accessibilityLabel={`${appStrings.home.todayWorkoutLabel}: ${title}`}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.borderStrong,
    borderCurve: 'continuous',
    borderRadius: theme.radii.xl,
    borderWidth: theme.borders.thin,
    gap: theme.spacing.xxl,
    overflow: 'hidden',
    padding: theme.spacing.xxl,
  },
  emblem: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.surfaceInteractive,
    borderRadius: theme.radii.md,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: theme.spacing.xxl,
    top: theme.spacing.xxl,
    width: 56,
  },
  copy: { gap: theme.spacing.sm, paddingRight: 68 },
});
