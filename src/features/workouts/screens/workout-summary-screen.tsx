import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';
import type { CompletedWorkoutSummary } from '@/features/workouts/domain/models';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';
import { theme } from '@/theme/tokens';

export function WorkoutSummaryScreen() {
  const { sessionId: rawSessionId } = useLocalSearchParams<{
    sessionId: string;
  }>();
  const sessionId = Number(rawSessionId);
  const database = useSQLiteContext();
  const router = useRouter();
  const [summary, setSummary] = useState<CompletedWorkoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setLoading(true);
      setError(false);
      if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
        setLoading(false);
        return () => {
          active = false;
        };
      }
      void createWorkoutSessionRepository(database)
        .getCompletedSummary(sessionId)
        .then((value) => {
          if (active) setSummary(value);
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
    }, [database, reloadKey, sessionId])
  );

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          description={appStrings.workout.loading}
          icon="trophy-outline"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  if (!summary) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          description={
            error
              ? appStrings.workout.loadError
              : appStrings.workout.sessionNotFoundDescription
          }
          icon="alert-circle-outline"
          title={
            error
              ? appStrings.database.errorTitle
              : appStrings.workout.sessionNotFound
          }
        />
        {error ? (
          <AppButton
            label={appStrings.workout.retry}
            onPress={() => setReloadKey((value) => value + 1)}
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppText tone="success" variant="label">
          {appStrings.workout.completedTitle}
        </AppText>
        <AppText accessibilityRole="header" variant="title">
          {summary.workoutName}
        </AppText>
        <AppText selectable tone="muted">
          {appStrings.workout.completionDescription}
        </AppText>
      </View>
      <View style={styles.metrics}>
        <AppCard style={styles.metricCard} tone="raised">
          <AppText tone="muted" variant="caption">
            Süre
          </AppText>
          <AppText variant="metric">
            {summary.durationMinutes === null
              ? '—'
              : `${summary.durationMinutes} dk`}
          </AppText>
        </AppCard>
        <AppCard style={styles.metricCard} tone="raised">
          <AppText tone="muted" variant="caption">
            Egzersiz
          </AppText>
          <AppText variant="metric">
            {summary.exerciseCount ?? summary.exerciseNames.length}
          </AppText>
        </AppCard>
        <AppCard style={styles.metricCard} tone="raised">
          <AppText tone="muted" variant="caption">
            {appStrings.workout.completedSets}
          </AppText>
          <AppText variant="metric">{summary.completedSetCount}</AppText>
        </AppCard>
        <AppCard style={styles.metricCard} tone="raised">
          <AppText tone="muted" variant="caption">
            Isınma seti
          </AppText>
          <AppText variant="metric">{summary.warmUpSetCount ?? 0}</AppText>
        </AppCard>
        <AppCard style={styles.metricCard} tone="raised">
          <AppText tone="muted" variant="caption">
            {appStrings.workout.totalRepetitions}
          </AppText>
          <AppText variant="metric">{summary.totalRepetitions}</AppText>
        </AppCard>
        <AppCard style={styles.metricCard} tone="raised">
          <AppText tone="muted" variant="caption">
            {appStrings.workout.totalVolume}
          </AppText>
          <AppText variant="metric">
            {formatWorkoutWeight(summary.totalVolume)} kg
          </AppText>
        </AppCard>
        {summary.averageEffort !== null &&
        summary.averageEffort !== undefined ? (
          <AppCard style={styles.metricCard} tone="raised">
            <AppText tone="muted" variant="caption">
              Ortalama {summary.averageEffortMode?.toUpperCase() ?? 'efor'}
            </AppText>
            <AppText variant="metric">
              {summary.averageEffort.toFixed(1)}
            </AppText>
          </AppCard>
        ) : null}
      </View>
      <AppCard tone="raised">
        <AppText variant="bodyStrong">Önceki benzer antrenman</AppText>
        <AppText selectable tone="muted">
          {summary.previousWorkoutVolume === null ||
          summary.previousWorkoutVolume === undefined
            ? 'Karşılaştırılabilir önceki kayıt bulunamadı.'
            : summary.previousWorkoutVolume === 0
              ? 'Önceki kayıtta karşılaştırılabilir hacim yok.'
              : `Önceki hacim ${formatWorkoutWeight(summary.previousWorkoutVolume)} kg.`}
        </AppText>
        <AppText tone="primary" variant="bodyStrong">
          {summary.personalRecordCount ?? 0} yeni rekor
        </AppText>
      </AppCard>
      <AppCard tone="raised">
        <AppText variant="bodyStrong">Egzersiz özeti</AppText>
        <AppText selectable tone="muted">
          {summary.exerciseNames.length > 0
            ? summary.exerciseNames.join(' · ')
            : 'Tamamlanan egzersiz bulunmuyor.'}
        </AppText>
      </AppCard>
      <AppButton
        label="Antrenman detayını incele"
        onPress={() => router.replace(`/workout/history/${summary.id}`)}
        variant="secondary"
      />
      <AppButton
        label={appStrings.workout.returnToWorkouts}
        onPress={() => router.replace('/workout')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.spacing.md },
  metricCard: { flexBasis: '46%', flexGrow: 1, gap: theme.spacing.sm },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
});
