import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { theme } from '@/theme/tokens';

type TodayWorkoutCardProps = {
  actionLabel: string;
  eyebrow: string;
  disabled?: boolean;
  onPress: () => void;
  summary: string;
  title: string;
};

export function TodayWorkoutCard({
  actionLabel,
  disabled,
  eyebrow,
  onPress,
  summary,
  title,
}: TodayWorkoutCardProps) {
  return (
    <View
      accessibilityLabel={`${appStrings.home.todayWorkoutLabel}: ${title}`}
      style={styles.card}
    >
      <View style={styles.copy}>
        <AppText tone="primary" variant="label">
          {eyebrow}
        </AppText>
        <AppText accessibilityRole="header" variant="title">
          {title}
        </AppText>
        <AppText selectable tone="muted" variant="bodyStrong">
          {summary}
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
    gap: theme.spacing.lg,
    overflow: 'hidden',
    padding: theme.spacing.lg,
  },
  copy: { gap: theme.spacing.xs },
});
