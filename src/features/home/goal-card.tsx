import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ProgressBar } from '@/components/progress-bar';
import type { BodyWeightSummary } from '@/features/body/domain/models';
import { formatSignedBodyValue } from '@/features/body/utils/body-formatters';
import { formatBodyValue } from '@/features/body/utils/body-values';
import { theme } from '@/theme/tokens';

type GoalCardProps = {
  onPress: () => void;
  summary: BodyWeightSummary;
};

export function GoalCard({ onPress, summary }: GoalCardProps) {
  const { profile, progress } = summary;

  return (
    <Pressable
      accessibilityLabel={`Gelişim, güncel ${formatBodyValue(summary.currentWeightKg)} kilogram, hedef ${formatBodyValue(profile.targetWeightKg)} kilogram`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <AppCard style={styles.card}>
        <View style={styles.header}>
          <AppText accessibilityRole="header" variant="heading">
            Gelişim
          </AppText>
          <AppText tone="primary" variant="caption">
            Aç
          </AppText>
        </View>
        <View style={styles.values}>
          <View style={styles.valueItem}>
            <AppText tone="muted" variant="caption">
              Güncel
            </AppText>
            <AppText selectable style={styles.number} variant="heading">
              {formatBodyValue(summary.currentWeightKg)} kg
            </AppText>
          </View>
          <View style={[styles.valueItem, styles.end]}>
            <AppText tone="muted" variant="caption">
              Hedef
            </AppText>
            <AppText selectable style={styles.number} variant="bodyStrong">
              {formatBodyValue(profile.targetWeightKg)} kg
            </AppText>
          </View>
        </View>
        <ProgressBar
          accessibilityLabel={`Hedef ilerlemesi yüzde ${progress.progressPercentage}`}
          progress={progress.progress}
        />
        <View style={styles.changeRow}>
          <AppText tone="muted" variant="caption">
            Başlangıçtan
          </AppText>
          <AppText selectable style={styles.number} variant="bodyStrong">
            {formatSignedBodyValue(progress.totalChangeKg)}
          </AppText>
          <AppText tone="muted" variant="caption">
            {progress.targetReached
              ? 'Hedef değerine ulaşıldı'
              : `${formatBodyValue(progress.remainingWeightKg)} kg kaldı`}
          </AppText>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.spacing.lg },
  changeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  end: { alignItems: 'flex-end' },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  valueItem: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  values: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  number: { fontVariant: ['tabular-nums'] },
  pressable: { borderRadius: theme.radii.lg },
  pressed: { opacity: 0.88 },
});
