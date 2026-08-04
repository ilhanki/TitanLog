import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { CompletedSetEditor } from '@/features/workouts/components/completed-set-editor';
import {
  WorkoutExerciseRow,
  workoutTableColumns,
} from '@/features/workouts/components/workout-exercise-row';
import {
  createWorkoutSessionRepository,
  WorkoutSessionError,
} from '@/features/workouts/data/workout-session-repository';
import { navigateBackOrReplace } from '@/navigation/safe-navigation';
import { createExercisePerformanceRepository } from '@/features/workouts/data/exercise-performance-repository';
import type {
  ExerciseAppearance,
  ExerciseRecords,
  PersonalRecordResult,
} from '@/features/workouts/domain/exercise-performance';
import type { WorkoutSession } from '@/features/workouts/domain/models';
import { comparePersonalRecords } from '@/features/workouts/utils/exercise-performance';
import {
  calculateSessionMetrics,
  formatWorkoutWeight,
} from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

function formatElapsedTime(startedAt: string, now: number): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 60_000)
  );
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return hours > 0 ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
}

export function ActiveWorkoutScreen() {
  const { sessionId: rawSessionId } = useLocalSearchParams<{
    sessionId: string;
  }>();
  const sessionId = Number(rawSessionId);
  const database = useSQLiteContext();
  const repository = createWorkoutSessionRepository(database);
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionPending, setSessionPending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [editorExerciseId, setEditorExerciseId] = useState<number | null>(null);
  const [previous, setPrevious] = useState<
    ReadonlyMap<number, ExerciseAppearance>
  >(new Map());
  const [recordBaselines, setRecordBaselines] = useState<
    ReadonlyMap<number, ExerciseRecords>
  >(new Map());
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState(false);
  const [recordMessage, setRecordMessage] = useState<string | null>(null);
  const [numericGestureActive, setNumericGestureActive] = useState(false);
  const announcedRecords = useRef(
    new Map<number, Map<PersonalRecordResult['kind'], number>>()
  );
  const sessionPendingRef = useRef(false);

  const refreshSession = async () => {
    const nextSession =
      await createWorkoutSessionRepository(database).getSessionDetails(
        sessionId
      );
    if (!nextSession) throw new WorkoutSessionError('session_not_active');
    setSession(nextSession);
    return nextSession;
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      setPerformanceLoading(true);
      setPerformanceError(false);
      if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
        setSession(null);
        setLoading(false);
        return () => {
          active = false;
        };
      }
      void createWorkoutSessionRepository(database)
        .getSessionDetails(sessionId)
        .then(async (nextSession) => {
          if (!active) return;
          setSession(nextSession);
          if (!nextSession || nextSession.status !== 'active') return;
          try {
            const performance = await createExercisePerformanceRepository(
              database
            ).getActiveExercisePerformance(
              nextSession.id,
              nextSession.exercises.map((exercise) => exercise.exerciseId)
            );
            if (active) {
              setPrevious(performance.previous);
              setRecordBaselines(performance.records);
            }
          } catch {
            if (active) setPerformanceError(true);
          } finally {
            if (active) setPerformanceLoading(false);
          }
        })
        .catch(() => {
          if (active) setError(appStrings.workout.loadError);
        })
        .finally(() => {
          if (active) {
            setLoading(false);
            setPerformanceLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [database, sessionId])
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!recordMessage) return;
    const timeout = setTimeout(() => setRecordMessage(null), 5000);
    return () => clearTimeout(timeout);
  }, [recordMessage]);

  const announceRecords = (
    exerciseId: number,
    records: readonly PersonalRecordResult[]
  ) => {
    const announced = announcedRecords.current.get(exerciseId) ?? new Map();
    const fresh = records.filter(
      (record) => record.value > (announced.get(record.kind) ?? -Infinity)
    );
    if (fresh.length === 0) return;
    for (const record of fresh) announced.set(record.kind, record.value);
    announcedRecords.current.set(exerciseId, announced);
    const message = fresh
      .map((record) => {
        if (record.kind === 'weight') {
          return `${appStrings.workout.newWeightRecord} · ${formatWorkoutWeight(record.value)} kg`;
        }
        if (record.kind === 'repetitions') {
          return `${appStrings.workout.newRepetitionRecord} · ${record.value} tekrar`;
        }
        return `${appStrings.workout.newVolumeRecord} · ${formatWorkoutWeight(record.value)} kg`;
      })
      .join(' · ');
    setRecordMessage(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  const runSessionWrite = async (operation: () => Promise<void>) => {
    if (sessionPendingRef.current) return;
    sessionPendingRef.current = true;
    setSessionPending(true);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      if (
        caught instanceof WorkoutSessionError &&
        caught.code === 'no_completed_sets'
      ) {
        setError(appStrings.workout.noCompletedSets);
      } else {
        setError(appStrings.workout.writeError);
      }
    } finally {
      sessionPendingRef.current = false;
      setSessionPending(false);
    }
  };

  const finish = () => {
    Alert.alert(
      appStrings.workout.finishTitle,
      appStrings.workout.finishDescription,
      [
        { style: 'cancel', text: appStrings.workout.keepWorkout },
        {
          text: appStrings.workout.finishConfirm,
          onPress: () =>
            void runSessionWrite(async () => {
              await repository.completeSession(sessionId);
              router.replace(`/workout/session/${sessionId}/summary` as Href);
            }),
        },
      ]
    );
  };

  const cancel = () => {
    Alert.alert(
      appStrings.workout.cancelTitle,
      appStrings.workout.cancelDescription,
      [
        { style: 'cancel', text: appStrings.workout.keepWorkout },
        {
          style: 'destructive',
          text: appStrings.workout.cancelConfirm,
          onPress: () =>
            void runSessionWrite(async () => {
              await repository.cancelSession(sessionId);
              router.replace('/workout');
            }),
        },
      ]
    );
  };

  useEffect(() => {
    if (session?.status === 'completed') {
      router.replace(`/workout/session/${sessionId}/summary` as Href);
    }
  }, [router, session?.status, sessionId]);

  if (loading || session?.status === 'completed') {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        <EmptyState
          description={appStrings.workout.loading}
          icon="dumbbell"
          title={appStrings.database.loadingTitle}
        />
      </Screen>
    );
  }

  if (!session || session.status === 'cancelled') {
    return (
      <Screen
        backgroundColor={workoutTheme.background}
        edges={['top', 'bottom']}
      >
        <EmptyState
          description={appStrings.workout.sessionNotFoundDescription}
          icon="alert-circle-outline"
          title={appStrings.workout.sessionNotFound}
        />
        <AppButton
          label={appStrings.common.goBack}
          onPress={() => navigateBackOrReplace(router, '/(tabs)/workout')}
        />
      </Screen>
    );
  }

  const metrics = calculateSessionMetrics(session);
  const totalSets = session.exercises.reduce(
    (count, exercise) => count + exercise.sets.length,
    0
  );
  const progress = totalSets > 0 ? metrics.completedSetCount / totalSets : 0;
  const editorExercise =
    session.exercises.find((exercise) => exercise.id === editorExerciseId) ??
    null;

  return (
    <Screen
      backgroundColor={workoutTheme.background}
      contentContainerStyle={styles.screenContent}
      edges={['top', 'bottom']}
      keyboardAware
      scrollViewProps={{ scrollEnabled: !numericGestureActive }}
    >
      <View style={styles.topBar}>
        <AppButton
          label={appStrings.common.goBack}
          onPress={() => navigateBackOrReplace(router, '/(tabs)/workout')}
          style={styles.compactAction}
          variant="ghost"
        />
        <View style={styles.titleCopy}>
          <AppText
            accessibilityRole="header"
            numberOfLines={1}
            variant="heading"
          >
            {session.workoutName}
          </AppText>
          <AppText selectable tone="muted" variant="caption">
            {formatElapsedTime(session.startedAt, now)} ·{' '}
            {metrics.completedSetCount}/{totalSets} {appStrings.workout.sets}
          </AppText>
        </View>
      </View>

      <ProgressBar
        accessibilityLabel={`${appStrings.workout.completedSets}: ${metrics.completedSetCount}/${totalSets}`}
        progress={progress}
      />

      <View style={styles.sessionActions}>
        <AppButton
          disabled={sessionPending}
          label={appStrings.workout.finishWorkout}
          onPress={finish}
          style={styles.sessionAction}
        />
        <AppButton
          disabled={sessionPending}
          label={appStrings.workout.cancelWorkout}
          onPress={cancel}
          style={styles.sessionAction}
          variant="ghost"
        />
      </View>

      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          selectable
          tone="danger"
        >
          {error}
        </AppText>
      ) : null}

      {recordMessage ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.recordBanner}
        >
          <AppText selectable tone="primary" variant="bodyStrong">
            {recordMessage}
          </AppText>
        </View>
      ) : null}

      <View style={styles.table}>
        <View accessibilityRole="header" style={styles.tableHeader}>
          <AppText style={styles.headerName} tone="muted" variant="caption">
            {appStrings.workout.tableExercise}
          </AppText>
          <AppText style={styles.headerCounter} tone="muted" variant="caption">
            {appStrings.workout.tableSet}
          </AppText>
          <AppText
            style={styles.headerRepetitions}
            tone="muted"
            variant="caption"
          >
            {appStrings.workout.tableRepetitions}
          </AppText>
          <AppText style={styles.headerWeight} tone="muted" variant="caption">
            {appStrings.workout.tableWeight}
          </AppText>
          <View
            accessibilityLabel={appStrings.workout.completeSet}
            style={styles.headerAction}
          />
        </View>
        {session.exercises.map((exercise) => (
          <WorkoutExerciseRow
            exercise={exercise}
            key={exercise.id}
            onComplete={async (setId, weightKg, actualReps) => {
              await repository.completeSetAndPrefillNext(
                setId,
                weightKg,
                actualReps
              );
              const refreshed = await refreshSession();
              const refreshedExercise = refreshed.exercises.find(
                (item) => item.exerciseId === exercise.exerciseId
              );
              const savedSet = refreshedExercise?.sets.find(
                (item) => item.id === setId && item.isCompleted
              );
              if (
                refreshedExercise &&
                savedSet &&
                savedSet.actualReps !== null
              ) {
                const volume = refreshedExercise.sets.reduce(
                  (total, item) =>
                    item.isCompleted && item.actualReps !== null
                      ? total + item.weightKg * item.actualReps
                      : total,
                  0
                );
                announceRecords(
                  exercise.exerciseId,
                  comparePersonalRecords(
                    {
                      actualReps: savedSet.actualReps,
                      setNumber: savedSet.setNumber,
                      weightKg: savedSet.weightKg,
                    },
                    volume,
                    recordBaselines.get(exercise.exerciseId) ?? null
                  )
                );
              }
            }}
            onOpenHistory={() =>
              router.push(
                `/workout/exercise/${exercise.exerciseId}/history` as Href
              )
            }
            onOpenEditor={() => setEditorExerciseId(exercise.id)}
            onNumericGestureActiveChange={setNumericGestureActive}
            previousPerformance={previous.get(exercise.exerciseId) ?? null}
            previousPerformanceError={performanceError}
            previousPerformanceLoading={performanceLoading}
          />
        ))}
      </View>
      <CompletedSetEditor
        exercise={editorExercise}
        onAddSet={async () => {
          if (!editorExercise) return;
          await repository.addSet(editorExercise.id);
          await refreshSession();
        }}
        onClose={() => setEditorExerciseId(null)}
        onRemoveSet={async () => {
          if (!editorExercise) return;
          await repository.removeLastIncompleteSet(editorExercise.id);
          await refreshSession();
        }}
        onSaveSet={async (setId, weightKg, actualReps) => {
          await repository.updateSetValues(setId, weightKg, actualReps);
          await refreshSession();
        }}
        visible={editorExercise !== null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  compactAction: { minHeight: theme.layout.compactTouchTarget },
  headerAction: { width: workoutTableColumns.action },
  headerCounter: {
    textAlign: 'center',
    width: workoutTableColumns.counter,
  },
  headerName: { flex: 1 },
  headerRepetitions: {
    textAlign: 'center',
    width: workoutTableColumns.repetitions,
  },
  headerWeight: {
    textAlign: 'center',
    width: workoutTableColumns.weight,
  },
  screenContent: { gap: theme.spacing.md, paddingHorizontal: theme.spacing.sm },
  sessionAction: { flex: 1, minHeight: theme.layout.compactTouchTarget },
  sessionActions: { flexDirection: 'row', gap: theme.spacing.sm },
  recordBanner: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    padding: theme.spacing.md,
  },
  table: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    overflow: 'hidden',
  },
  tableHeader: {
    alignItems: 'center',
    backgroundColor: workoutTheme.input,
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.thin,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: 32,
    paddingHorizontal: theme.spacing.sm,
  },
  titleCopy: { flex: 1, gap: theme.spacing.xs },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
});
