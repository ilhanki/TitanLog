import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { createExercisePerformanceRepository } from '@/features/workouts/data/exercise-performance-repository';
import type {
  ExerciseHistory,
  ExerciseRecord,
} from '@/features/workouts/domain/exercise-performance';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(date)
    : 'Tarih bilgisi yok';
}

function recordValue(
  record: ExerciseRecord | null,
  kind: 'weight' | 'repetitions' | 'volume'
): string {
  if (!record) return '—';
  if (kind === 'repetitions') return `${record.value} tekrar`;
  return `${formatWorkoutWeight(record.value)} kg`;
}

export function ExerciseHistoryScreen() {
  const { exerciseId: rawExerciseId } = useLocalSearchParams<{
    exerciseId: string;
  }>();
  const exerciseId = Number(rawExerciseId);
  const validId = Number.isSafeInteger(exerciseId) && exerciseId > 0;
  const database = useSQLiteContext();
  const router = useRouter();
  const [history, setHistory] = useState<ExerciseHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loadingMoreRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setHistory(null);
      setError(false);
      if (!validId) {
        setLoading(false);
        return () => {
          active = false;
        };
      }
      setLoading(true);
      void createExercisePerformanceRepository(database)
        .getExerciseHistory(exerciseId, PAGE_SIZE, 0)
        .then((value) => {
          if (active) setHistory(value);
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
    }, [database, exerciseId, reloadKey, validId])
  );

  const loadMore = async () => {
    if (!history?.hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const next = await createExercisePerformanceRepository(
        database
      ).getExerciseHistory(
        exerciseId,
        PAGE_SIZE,
        history.recentAppearances.length
      );
      if (!next) return;
      setHistory((current) => {
        if (!current) return next;
        const seen = new Set(
          current.recentAppearances.map((item) => item.sessionExerciseId)
        );
        return {
          ...current,
          hasMore: next.hasMore,
          recentAppearances: [
            ...current.recentAppearances,
            ...next.recentAppearances.filter(
              (item) => !seen.has(item.sessionExerciseId)
            ),
          ],
        };
      });
    } catch {
      setError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <AppButton
        label={appStrings.common.goBack}
        onPress={() => router.back()}
        variant="ghost"
      />
      <AppText accessibilityRole="header" variant="title">
        {appStrings.workout.exerciseHistoryTitle}
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
          description={appStrings.workout.exerciseHistoryLoading}
          icon="history"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }
  if (error && !history) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        {header}
        <EmptyState
          description={appStrings.workout.exerciseHistoryError}
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
  if (!validId || !history) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        {header}
        <EmptyState
          description={appStrings.workout.exerciseHistoryNotFoundDescription}
          icon="history"
          title={appStrings.workout.exerciseHistoryNotFound}
        />
      </Screen>
    );
  }

  const recordItems = [
    {
      label: appStrings.workout.highestWeightRecord,
      record: history.records.highestWeight,
      value: recordValue(history.records.highestWeight, 'weight'),
    },
    {
      label: appStrings.workout.highestRepetitionRecord,
      record: history.records.highestRepetitions,
      value: recordValue(history.records.highestRepetitions, 'repetitions'),
    },
    {
      label: appStrings.workout.highestVolumeRecord,
      record: history.records.highestSessionVolume,
      value: recordValue(history.records.highestSessionVolume, 'volume'),
    },
    {
      label: appStrings.workout.lastExerciseWorkout,
      record: null,
      value: history.records.lastPerformance
        ? formatDate(history.records.lastPerformance.completedAt)
        : '—',
    },
  ];

  return (
    <Screen backgroundColor={workoutTheme.background} edges={['top', 'bottom']}>
      {header}
      <View style={styles.exerciseHeader}>
        <AppText accessibilityRole="header" numberOfLines={2} variant="heading">
          {history.exerciseName}
        </AppText>
        <AppText selectable tone="muted">
          {[
            history.muscleGroup,
            history.equipment,
            history.weightMode === 'per_hand'
              ? appStrings.workout.perHand
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </View>
      {history.legacyMatched ? (
        <AppText selectable tone="information" variant="caption">
          {appStrings.workout.legacyExerciseHistoryNote}
        </AppText>
      ) : null}
      <View style={styles.recordGrid}>
        {recordItems.map((item) => (
          <View
            accessibilityLabel={`${item.label}: ${item.value}${item.record ? `. İlk tarih ${formatDate(item.record.achievedAt)}` : ''}`}
            accessible
            key={item.label}
            style={styles.recordCell}
          >
            <AppText tone="muted" variant="caption">
              {item.label}
            </AppText>
            <AppText selectable variant="bodyStrong">
              {item.value}
            </AppText>
            {item.record ? (
              <AppText selectable tone="subtle" variant="caption">
                {formatDate(item.record.achievedAt)}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>
      <AppText accessibilityRole="header" variant="heading">
        {appStrings.workout.recentExerciseRecords}
      </AppText>
      {history.recentAppearances.length === 0 ? (
        <EmptyState
          description={appStrings.workout.exerciseHistoryEmptyDescription}
          icon="history"
          title={appStrings.workout.exerciseHistoryEmpty}
        />
      ) : (
        <View style={styles.appearanceList}>
          {history.recentAppearances.map((appearance) => (
            <View key={appearance.sessionExerciseId} style={styles.appearance}>
              <AppText selectable numberOfLines={2} variant="bodyStrong">
                {formatDate(appearance.completedAt)} · {appearance.workoutName}
              </AppText>
              <AppText selectable tone="muted" variant="caption">
                {appearance.completedSetCount} set ·{' '}
                {appearance.totalRepetitions} tekrar ·{' '}
                {appearance.highestWeightKg === null
                  ? '—'
                  : `${formatWorkoutWeight(appearance.highestWeightKg)} kg ${appStrings.workout.highestWeightCompact}`}{' '}
                · {formatWorkoutWeight(appearance.totalVolume)} kg
              </AppText>
              {appearance.sets.map((set) => (
                <View key={set.setNumber} style={styles.setRow}>
                  <AppText
                    selectable
                    style={styles.setNumber}
                    variant="caption"
                  >
                    Set {set.setNumber}
                  </AppText>
                  <AppText selectable style={styles.setValue} variant="caption">
                    {formatWorkoutWeight(set.weightKg)} kg
                  </AppText>
                  <AppText selectable style={styles.setValue} variant="caption">
                    {set.actualReps} tekrar
                  </AppText>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
      {history.hasMore ? (
        <AppButton
          disabled={loadingMore}
          label={appStrings.workout.loadMoreExerciseHistory}
          onPress={() => void loadMore()}
          variant="secondary"
        />
      ) : null}
      {error ? (
        <AppText accessibilityRole="alert" tone="danger">
          {appStrings.workout.exerciseHistoryError}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  appearance: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    gap: theme.spacing.sm,
    overflow: 'hidden',
    padding: theme.spacing.md,
  },
  appearanceList: { gap: theme.spacing.md },
  exerciseHeader: { gap: theme.spacing.xs },
  header: { gap: theme.spacing.sm },
  recordCell: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thin,
    flexBasis: '46%',
    flexGrow: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  recordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  setNumber: { flex: 1 },
  setRow: {
    borderTopColor: workoutTheme.separator,
    borderTopWidth: theme.borders.hairline,
    flexDirection: 'row',
    minHeight: theme.layout.compactTouchTarget,
    paddingVertical: theme.spacing.sm,
  },
  setValue: { textAlign: 'right', width: 88 },
});
