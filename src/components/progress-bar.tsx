import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme/tokens';

type ProgressBarProps = {
  accessibilityLabel: string;
  progress: number;
};

export function ProgressBar({
  accessibilityLabel,
  progress,
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{
        max: 100,
        min: 0,
        now: Math.round(clampedProgress * 100),
      }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${clampedProgress * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: theme.colors.surfaceInteractive,
    borderRadius: theme.radii.pill,
    height: theme.spacing.sm,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.pill,
    height: '100%',
  },
});
