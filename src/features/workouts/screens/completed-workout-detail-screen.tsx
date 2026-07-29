import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';
import type {
  CompletedWorkoutComparison,
  CompletedWorkoutDetail,
} from '@/features/workouts/domain/models';
import {
  formatWorkoutDate,
  formatWorkoutDifference,
  formatWorkoutDuration,
} from '@/features/workouts/utils/workout-formatters';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type ComparisonRowProps = { label: string; value: string };

function ComparisonRow({ label, value }: ComparisonRowProps) {
  return (
    <View style={styles.comparisonRow}>
      <AppText selectable tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText selectable style={styles.tabular} variant="bodyStrong">
        {value}
      </AppText>
    </View>
  );
}

function describeDifference(value: number, unit: string): string {
  if (value === 0) return appStrings.workout.unchanged;
  return `${formatWorkoutDifference(value, unit)} · ${
    value > 0 ? appStrings.workout.increase : appStrings.workout.decrease
  }`;
}

function describeDurationDifference(value: number | null): string {
  if (value === null) return appStrings.workout.unavailableComparison;
  if (value === 0) return appStrings.workout.unchanged;
  return `${formatWorkoutDifference(value, 'dk')} · ${
    value > 0 ? appStrings.workout.longer : appStrings.workout.shorter
  }`;
}

function ComparisonSection({
  comparison,
}: {
  comparison: CompletedWorkoutComparison | null;
}) {
  return (
    <View style={styles.section}>
      <AppText accessibilityRole="header" variant="heading">
        {appStrings.workout.comparisonTitle}
      </AppText>
      {comparison ? (
        <View style={styles.panel}>
          <ComparisonRow
            label={appStrings.workout.previousWorkout}
            value={formatWorkoutDate(comparison.previousCompletedAt)}
          />
          <ComparisonRow
            label={appStrings.workout.volumeDifference}
            value={`${describeDifference(comparison.totalVolumeDifference, 'kg')}${
              comparison.volumePercentageDifference === null
                ? ''
                : ` (${formatWorkoutDifference(
                    comparison.volumePercentageDifference,
                    '%'
                  )})`
            }`}
          />
          <ComparisonRow
            label={appStrings.workout.setDifference}
            value={describeDifference(comparison.completedSetDifference, 'set')}
          />
          <ComparisonRow
            label={appStrings.workout.repetitionDifference}
            value={describeDifference(
              comparison.totalRepetitionDifference,
              appStrings.workout.repetitions
            )}
          />
          <ComparisonRow
            label={appStrings.workout.durationDifference}
            value={describeDurationDifference(
              comparison.durationDifferenceMinutes
            )}
          />
        </View>
      ) : (
        <AppText selectable tone="muted">
          {appStrings.workout.noComparison}
        </AppText>
      )}
    </View>
  );
}

export function CompletedWorkoutDetailScreen() {
  const { sessionId: rawSessionId } = useLocalSearchParams<{
    sessionId: string;
  }>();
  const sessionId = Number(rawSessionId);
  const database = useSQLiteContext();
  const router = useRouter();
  const [detail, setDetail] = useState<CompletedWorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const validSessionId = Number.isSafeInteger(sessionId) && sessionId > 0;

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setDetail(null);
      setError(false);
      if (!validSessionId) {
        setLoading(false);
        return () => {
          active = false;
        };
      }
      setLoading(true);
      void createWorkoutSessionRepository(database)
        .getCompletedWorkoutDetail(sessionId)
        .then((nextDetail) => {
          if (active) setDetail(nextDetail);
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [database, reloadKey, sessionId, validSessionId])
  );

  const header = (
    <View style={styles.header}>
      <AppButton
        icon="arrow-left"
        label={appStrings.common.goBack}
        onPress={() => router.back()}
        style={styles.backButton}
        variant="ghost"
      />
      <AppText
        accessibilityRole="header"
        style={styles.headerTitle}
        variant="title"
      >
        {appStrings.workout.detailTitle}
      </AppText>
    </View>
  );

  if (loading) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        {header}
        <EmptyState
          description={appStrings.workout.detailLoading}
          icon="history"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        {header}
        <EmptyState
          description={appStrings.workout.detailLoadError}
          icon="alert-circle-outline"
          title={appStrings.database.errorTitle}
        />
        <AppButton
          label={appStrings.workout.retry}
          onPress={() => setReloadKey((value) => value + 1)}
        />
      </Screen>
    );
  }

  if (!validSessionId || !detail) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        {header}
        <EmptyState
          description={appStrings.workout.detailNotFoundDescription}
          icon="history"
          title={appStrings.workout.detailNotFound}
        />
      </Screen>
    );
  }

  const metrics = [
    {
      label: appStrings.workout.duration,
      value: formatWorkoutDuration(detail.durationMinutes),
    },
    {
      label: appStrings.workout.completedSets,
      value: String(detail.completedSetCount),
    },
    {
      label: appStrings.workout.totalRepetitions,
      value: String(detail.totalRepetitions),
    },
    {
      label: appStrings.workout.totalVolume,
      value: `${formatWorkoutWeight(detail.totalVolume)} kg`,
    },
  ];

  return (
    <Screen backgroundColor={workoutTheme.background} edges={['top', 'bottom']}>
      {header}
      <View style={styles.hero}>
        <AppText selectable variant="heading">
          {detail.workoutName}
        </AppText>
        <AppText selectable tone="muted">
          {formatWorkoutDate(detail.completedAt)}
        </AppText>
      </View>
      <View style={styles.metricGrid}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCell}>
            <AppText selectable tone="muted" variant="caption">
              {metric.label}
            </AppText>
            <AppText selectable style={styles.tabular} variant="bodyStrong">
              {metric.value}
            </AppText>
          </View>
        ))}
      </View>
      <ComparisonSection comparison={detail.comparison} />
      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="heading">
          {appStrings.workout.exerciseBreakdown}
        </AppText>
        {detail.exercises.map((exercise) => (
          <View key={exercise.id} style={styles.exercisePanel}>
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseCopy}>
                <AppText
                  accessibilityLabel={`${exercise.name}${
                    exercise.weightMode === 'per_hand'
                      ? `, ${appStrings.workout.perHand}`
                      : ''
                  }`}
                  numberOfLines={1}
                  variant="bodyStrong"
                >
                  {exercise.name}
                  {exercise.weightMode === 'per_hand' ? ' · el' : ''}
                </AppText>
                <AppText selectable tone="muted" variant="caption">
                  {exercise.completedSetCount} {appStrings.workout.sets} ·{' '}
                  {exercise.totalRepetitions} {appStrings.workout.repetitions} ·{' '}
                  {formatWorkoutWeight(exercise.totalVolume)} kg
                </AppText>
              </View>
              <AppButton
                accessibilityLabel={`${exercise.name}: ${appStrings.workout.exerciseHistoryAction}`}
                label={appStrings.workout.exerciseHistoryAction}
                onPress={() =>
                  router.push(
                    `/workout/exercise/${exercise.exerciseId}/history` as Href
                  )
                }
                variant="ghost"
              />
            </View>
            <View accessibilityRole="header" style={styles.setHeader}>
              <AppText style={styles.setNumber} tone="subtle" variant="caption">
                {appStrings.workout.tableSet}
              </AppText>
              <AppText style={styles.setValue} tone="subtle" variant="caption">
                {appStrings.workout.tableRepetitions}
              </AppText>
              <AppText style={styles.setWeight} tone="subtle" variant="caption">
                {appStrings.workout.tableWeight}
              </AppText>
              <AppText style={styles.setStatus} tone="subtle" variant="caption">
                Durum
              </AppText>
            </View>
            {exercise.sets.map((workoutSet) => (
              <View
                accessibilityLabel={`${exercise.name}, Set ${workoutSet.setNumber}, ${
                  workoutSet.isCompleted
                    ? `${workoutSet.actualReps} ${appStrings.workout.repetitions}, ${formatWorkoutWeight(workoutSet.weightKg)} kg, ${appStrings.workout.completedSetStatus}`
                    : appStrings.workout.incompleteSetStatus
                }`}
                accessible
                key={workoutSet.id}
                style={styles.setRow}
              >
                <AppText selectable style={styles.setNumber} variant="caption">
                  {workoutSet.setNumber}
                </AppText>
                <AppText selectable style={styles.setValue} variant="caption">
                  {workoutSet.isCompleted
                    ? (workoutSet.actualReps ?? '—')
                    : '—'}
                </AppText>
                <AppText selectable style={styles.setWeight} variant="caption">
                  {formatWorkoutWeight(workoutSet.weightKg)}
                </AppText>
                <AppText
                  selectable
                  style={styles.setStatus}
                  tone={workoutSet.isCompleted ? 'success' : 'subtle'}
                  variant="caption"
                >
                  {workoutSet.isCompleted
                    ? appStrings.workout.completedSetStatus
                    : appStrings.workout.incompleteSetStatus}
                </AppText>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { minHeight: theme.layout.compactTouchTarget },
  comparisonRow: {
    alignItems: 'center',
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
    minHeight: theme.layout.compactTouchTarget,
    paddingVertical: theme.spacing.sm,
  },
  exerciseCopy: { flex: 1, gap: theme.spacing.xs, minWidth: 0 },
  exerciseHeader: { flexDirection: 'row', padding: theme.spacing.md },
  exercisePanel: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    overflow: 'hidden',
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md },
  headerTitle: { flex: 1 },
  hero: { gap: theme.spacing.xs },
  metricCell: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thin,
    flexBasis: '46%',
    flexGrow: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  panel: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    paddingHorizontal: theme.spacing.md,
  },
  section: { gap: theme.spacing.md },
  setHeader: {
    backgroundColor: workoutTheme.input,
    borderTopColor: workoutTheme.separator,
    borderTopWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  setNumber: { textAlign: 'center', width: 32 },
  setRow: {
    borderTopColor: workoutTheme.separator,
    borderTopWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: theme.layout.compactTouchTarget,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  setStatus: { flex: 1, textAlign: 'right' },
  setValue: { textAlign: 'center', width: 44 },
  setWeight: { textAlign: 'center', width: 60 },
  tabular: { fontVariant: ['tabular-nums'] },
});
