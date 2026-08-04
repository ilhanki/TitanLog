import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { CompletedWorkoutRow } from '@/features/workouts/components/completed-workout-row';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';
import type { CompletedWorkoutHistoryItem } from '@/features/workouts/domain/models';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

const HISTORY_PAGE_SIZE = 20;

export function WorkoutHistoryScreen({
  showBack = true,
}: {
  showBack?: boolean;
}) {
  const database = useSQLiteContext();
  const router = useRouter();
  const [history, setHistory] = useState<CompletedWorkoutHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loadingMoreRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void reloadKey;
      let active = true;
      setLoading(true);
      setError(false);
      const repository = createWorkoutSessionRepository(database);
      void Promise.all([
        repository.getCompletedWorkoutHistory(HISTORY_PAGE_SIZE, 0),
        repository.getCompletedSessionCount(),
      ])
        .then(([items, count]) => {
          if (active) {
            setHistory(items);
            setTotalCount(count);
          }
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
    }, [database, reloadKey])
  );

  const loadMore = async () => {
    if (loadingMoreRef.current || history.length >= totalCount) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(false);
    try {
      const items = await createWorkoutSessionRepository(
        database
      ).getCompletedWorkoutHistory(HISTORY_PAGE_SIZE, history.length);
      setHistory((current) => [...current, ...items]);
    } catch {
      setError(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const header = (
    <View style={styles.header}>
      {showBack ? (
        <AppButton
          icon="arrow-left"
          label={appStrings.common.goBack}
          onPress={() => router.back()}
          style={styles.backButton}
          variant="ghost"
        />
      ) : null}
      <View style={styles.headerCopy}>
        <AppText accessibilityRole="header" variant="title">
          {appStrings.workout.historyTitle}
        </AppText>
        <AppText selectable tone="muted" variant="caption">
          {appStrings.workout.historyDescription}
        </AppText>
      </View>
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
          description={appStrings.workout.historyLoading}
          icon="history"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  if (error && history.length === 0) {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        {header}
        <EmptyState
          description={appStrings.workout.historyLoadError}
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

  return (
    <Screen backgroundColor={workoutTheme.background} edges={['top', 'bottom']}>
      {header}
      {history.length === 0 ? (
        <EmptyState
          description={appStrings.workout.noHistoryDescription}
          icon="history"
          title={appStrings.workout.noHistoryTitle}
        />
      ) : (
        <View style={styles.list}>
          {history.map((workout) => (
            <CompletedWorkoutRow
              key={workout.id}
              onPress={() =>
                router.push(`/workout/history/${workout.id}` as Href)
              }
              workout={workout}
            />
          ))}
        </View>
      )}
      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          selectable
          tone="danger"
        >
          {appStrings.workout.historyLoadError}
        </AppText>
      ) : null}
      {history.length < totalCount ? (
        <AppButton
          disabled={loadingMore}
          label={appStrings.workout.loadMoreHistory}
          onPress={() => void loadMore()}
          variant="secondary"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { minHeight: theme.layout.compactTouchTarget },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  headerCopy: { flex: 1, gap: theme.spacing.xs },
  list: {
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    overflow: 'hidden',
  },
});
