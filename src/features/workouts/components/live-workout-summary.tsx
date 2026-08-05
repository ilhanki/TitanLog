import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { WorkoutSession } from '@/features/workouts/domain/models';
import {
  calculateSessionMetrics,
  formatWorkoutWeight,
} from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type LiveWorkoutSummaryProps = {
  elapsed: string;
  personalRecordCount: number;
  session: WorkoutSession;
};

export function LiveWorkoutSummary({
  elapsed,
  personalRecordCount,
  session,
}: LiveWorkoutSummaryProps) {
  const metrics = calculateSessionMetrics(session);
  const remaining = session.exercises.filter(
    (exercise) =>
      !exercise.isSkipped &&
      !exercise.sets.some(
        (set) => set.isCompleted && (set.setType ?? 'working') !== 'warm_up'
      )
  ).length;
  const summary = `${elapsed}; ${metrics.completedExerciseCount} egzersiz; ${metrics.completedSetCount} çalışma seti; ${metrics.totalRepetitions} tekrar; ${formatWorkoutWeight(metrics.totalVolume)} kilogram hacim; ${remaining} egzersiz kaldı; ${personalRecordCount} rekor.`;

  return (
    <View accessibilityLabel={summary} style={styles.card}>
      <AppText variant="bodyStrong">Canlı özet</AppText>
      <View style={styles.metrics}>
        <Metric label="Süre" value={elapsed} />
        <Metric
          label="Çalışma seti"
          value={String(metrics.completedSetCount)}
        />
        <Metric label="Tekrar" value={String(metrics.totalRepetitions)} />
        <Metric
          label="Hacim"
          value={`${formatWorkoutWeight(metrics.totalVolume)} kg`}
        />
        <Metric label="Kalan" value={String(remaining)} />
        <Metric label="Rekor" value={String(personalRecordCount)} />
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText selectable style={styles.value} variant="bodyStrong">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  metric: { flexBasis: '28%', flexGrow: 1, gap: theme.spacing.xxs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  value: { fontVariant: ['tabular-nums'] },
});
