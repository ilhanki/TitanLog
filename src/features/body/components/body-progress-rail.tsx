import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { BodyWeightSummary } from '@/features/body/domain/models';
import { formatBodyValue } from '@/features/body/utils/body-values';
import { theme } from '@/theme/tokens';

type BodyProgressRailProps = {
  summary: BodyWeightSummary;
};

export function BodyProgressRail({ summary }: BodyProgressRailProps) {
  const { currentWeightKg, profile, progress } = summary;
  const percentage = Math.round(progress.progress * 100);
  const accessibilityLabel = `Başlangıç ${formatBodyValue(profile.startingWeightKg)} kilogram, güncel ${formatBodyValue(currentWeightKg)} kilogram, hedef ${formatBodyValue(profile.targetWeightKg)} kilogram.`;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessible
      style={styles.root}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.rail}
      >
        <View style={[styles.achieved, { width: `${percentage}%` }]} />
        <View style={[styles.currentMarker, { left: `${percentage}%` }]} />
      </View>
      <View style={styles.labels}>
        <View style={styles.labelGroup}>
          <AppText tone="muted" variant="caption">
            Başlangıç
          </AppText>
          <AppText selectable style={styles.number} variant="bodyStrong">
            {formatBodyValue(profile.startingWeightKg)} kg
          </AppText>
        </View>
        <View style={[styles.labelGroup, styles.centerLabel]}>
          <AppText tone="primary" variant="caption">
            Güncel
          </AppText>
          <AppText selectable style={styles.number} variant="bodyStrong">
            {formatBodyValue(currentWeightKg)} kg
          </AppText>
        </View>
        <View style={[styles.labelGroup, styles.endLabel]}>
          <AppText tone="muted" variant="caption">
            Hedef
          </AppText>
          <AppText selectable style={styles.number} variant="bodyStrong">
            {formatBodyValue(profile.targetWeightKg)} kg
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  achieved: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.pill,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  centerLabel: { alignItems: 'center' },
  currentMarker: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.backgroundElevated,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.strong,
    height: 14,
    marginLeft: -7,
    marginTop: -5,
    position: 'absolute',
    width: 14,
  },
  endLabel: { alignItems: 'flex-end' },
  labelGroup: { flex: 1, gap: theme.spacing.xxs },
  labels: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  number: { fontVariant: ['tabular-nums'] },
  rail: {
    backgroundColor: theme.colors.borderStrong,
    borderRadius: theme.radii.pill,
    height: 4,
    position: 'relative',
  },
  root: { gap: theme.spacing.sm },
});
