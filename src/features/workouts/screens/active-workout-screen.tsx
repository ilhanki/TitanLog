import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { EmptyState } from '@/components/empty-state';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import {
  createProfilePreferencesRepository,
  type ProfilePreferences,
} from '@/features/profile/profile-preferences';
import { CompletedSetEditor } from '@/features/workouts/components/completed-set-editor';
import { ActiveExerciseManager } from '@/features/workouts/components/active-exercise-manager';
import { RestTimerCard } from '@/features/workouts/components/rest-timer-card';
import { LiveWorkoutSummary } from '@/features/workouts/components/live-workout-summary';
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
import type {
  AvailableExercise,
  WorkoutSession,
  WorkoutSessionExercise,
} from '@/features/workouts/domain/models';
import {
  createRestTimerState,
  shouldEmitRestFinished,
  shouldStartRestAfterSet,
} from '@/features/workouts/domain/rest-timer';
import {
  cancelRestTimerNotification,
  emitWorkoutHaptic,
  scheduleRestTimerNotification,
} from '@/features/workouts/services/workout-feedback';
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
  const repository = useMemo(
    () => createWorkoutSessionRepository(database),
    [database]
  );
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
  const [personalRecordCount, setPersonalRecordCount] = useState(0);
  const [availableExercises, setAvailableExercises] = useState<
    readonly AvailableExercise[]
  >([]);
  const [replaceTarget, setReplaceTarget] =
    useState<WorkoutSessionExercise | null>(null);
  const [exerciseManagerVisible, setExerciseManagerVisible] = useState(false);
  const [supersetSelection, setSupersetSelection] = useState<readonly number[]>(
    []
  );
  const [workoutPreferences, setWorkoutPreferences] = useState<
    Pick<
      ProfilePreferences,
      | 'globalRestSeconds'
      | 'workoutEffortMode'
      | 'workoutHapticsEnabled'
      | 'workoutKeepAwakeEnabled'
      | 'weightUnit'
    >
  >({
    globalRestSeconds: 90,
    workoutEffortMode: 'off',
    workoutHapticsEnabled: true,
    workoutKeepAwakeEnabled: true,
    weightUnit: 'kg',
  });
  const [numericGestureActive, setNumericGestureActive] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const announcedRecords = useRef(
    new Map<number, Map<PersonalRecordResult['kind'], number>>()
  );
  const sessionPendingRef = useRef(false);

  const refreshSession = useCallback(async () => {
    const nextSession =
      await createWorkoutSessionRepository(database).getSessionDetails(
        sessionId
      );
    if (!nextSession) throw new WorkoutSessionError('session_not_active');
    setSession(nextSession);
    return nextSession;
  }, [database, sessionId]);

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
          setNotesDraft(nextSession?.notes ?? '');
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
    const interval = setInterval(
      () => setNow(Date.now()),
      session?.restTimer ? 1000 : 30_000
    );
    return () => clearInterval(interval);
  }, [session?.restTimer]);

  useEffect(() => {
    void createProfilePreferencesRepository(database)
      .get()
      .then((preferences) => setWorkoutPreferences(preferences))
      .catch(() => undefined);
  }, [database]);

  useEffect(() => {
    const tag = 'titanlog-active-workout';
    if (!workoutPreferences.workoutKeepAwakeEnabled) return;
    void activateKeepAwakeAsync(tag).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(tag).catch(() => undefined);
    };
  }, [workoutPreferences.workoutKeepAwakeEnabled]);

  useEffect(() => {
    const timer = session?.restTimer;
    if (!timer || !shouldEmitRestFinished(timer, now)) return;
    void repository
      .markRestTimerAlerted(sessionId, new Date(now).toISOString())
      .then(async (marked) => {
        if (!marked) return;
        await emitWorkoutHaptic(
          'timer_finished',
          workoutPreferences.workoutHapticsEnabled
        );
        AccessibilityInfo.announceForAccessibility(
          'Dinlenme tamamlandı. Sıradaki sete hazırsın.'
        );
        await refreshSession();
      })
      .catch(() => undefined);
  }, [
    now,
    repository,
    refreshSession,
    session?.restTimer,
    sessionId,
    workoutPreferences.workoutHapticsEnabled,
  ]);

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
    setPersonalRecordCount((count) => count + fresh.length);
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

  const startRest = async (
    durationSeconds: number,
    sessionExerciseId: number | null
  ) => {
    const startedAt = Date.now();
    const preview = createRestTimerState(
      durationSeconds,
      startedAt,
      sessionExerciseId
    );
    await cancelRestTimerNotification(
      session?.restTimer?.notificationIdentifier
    );
    const notificationIdentifier = await scheduleRestTimerNotification(
      preview.deadline
    );
    await repository.startRestTimer(
      sessionId,
      durationSeconds,
      sessionExerciseId,
      notificationIdentifier,
      startedAt
    );
    await refreshSession();
  };

  const adjustRest = async (deltaSeconds: number) => {
    await cancelRestTimerNotification(
      session?.restTimer?.notificationIdentifier
    );
    const adjusted = await repository.adjustRestTimer(sessionId, deltaSeconds);
    if (adjusted) {
      const identifier = await scheduleRestTimerNotification(adjusted.deadline);
      await repository.setRestTimerNotificationIdentifier(
        sessionId,
        identifier
      );
    }
    await refreshSession();
  };

  const cancelRest = async () => {
    await cancelRestTimerNotification(
      session?.restTimer?.notificationIdentifier
    );
    await repository.cancelRestTimer(sessionId);
    await refreshSession();
  };

  const openExerciseManager = async (
    target: WorkoutSessionExercise | null = null
  ) => {
    setReplaceTarget(target);
    setAvailableExercises(
      await repository.getAvailableExercisesForSession(sessionId)
    );
    setExerciseManagerVisible(true);
  };

  const createActiveSuperset = async () => {
    await repository.createSessionSuperset(sessionId, supersetSelection);
    setSupersetSelection([]);
    await refreshSession();
    AccessibilityInfo.announceForAccessibility(
      'Aktif superset grubu oluşturuldu.'
    );
  };

  const selectedGroupId = session?.exercises.find((exercise) =>
    supersetSelection.includes(exercise.id)
  )?.supersetGroupId;

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
              await cancelRestTimerNotification(
                session?.restTimer?.notificationIdentifier
              );
              await repository.completeSession(sessionId);
              await emitWorkoutHaptic(
                'workout_completed',
                workoutPreferences.workoutHapticsEnabled
              );
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
              await cancelRestTimerNotification(
                session?.restTimer?.notificationIdentifier
              );
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

      <RestTimerCard
        exerciseName={
          session.exercises.find(
            (exercise) => exercise.id === session.restTimer?.sessionExerciseId
          )?.name
        }
        now={now}
        onAdjust={(seconds) => void runSessionWrite(() => adjustRest(seconds))}
        onCancel={() => void runSessionWrite(cancelRest)}
        onStart={(seconds) =>
          void runSessionWrite(() => startRest(seconds, null))
        }
        pending={sessionPending}
        timer={session.restTimer ?? null}
      />

      <LiveWorkoutSummary
        elapsed={formatElapsedTime(session.startedAt, now)}
        personalRecordCount={personalRecordCount}
        session={session}
      />

      <View style={styles.notesCard}>
        <AppText variant="bodyStrong">Antrenman notu</AppText>
        <AppTextInput
          accessibilityLabel="Aktif antrenman notu"
          label="Not"
          maxLength={500}
          multiline
          onChangeText={setNotesDraft}
          placeholder="İstersen kısa bir not ekle"
          value={notesDraft}
        />
        <AppButton
          disabled={
            sessionPending || notesDraft.trim() === (session.notes ?? '')
          }
          label="Notu kaydet"
          onPress={() =>
            void runSessionWrite(async () => {
              await repository.updateSessionNotes(sessionId, notesDraft);
              await refreshSession();
              AccessibilityInfo.announceForAccessibility(
                'Antrenman notu kaydedildi.'
              );
            })
          }
          variant="secondary"
        />
      </View>

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
      <AppButton
        disabled={sessionPending}
        label="Aktif antrenmana hareket ekle"
        onPress={() => void runSessionWrite(() => openExerciseManager())}
        variant="secondary"
      />
      <View style={styles.supersetActions}>
        <AppButton
          disabled={sessionPending || supersetSelection.length < 2}
          label={`Superset oluştur (${supersetSelection.length})`}
          onPress={() => void runSessionWrite(createActiveSuperset)}
          style={styles.sessionAction}
          variant="secondary"
        />
        <AppButton
          disabled={sessionPending || !selectedGroupId}
          label="Grubu çöz"
          onPress={() =>
            void runSessionWrite(async () => {
              if (!selectedGroupId) return;
              await repository.dissolveSessionSuperset(
                sessionId,
                selectedGroupId
              );
              setSupersetSelection([]);
              await refreshSession();
            })
          }
          style={styles.sessionAction}
          variant="ghost"
        />
        <AppButton
          disabled={
            sessionPending || supersetSelection.length !== 1 || !selectedGroupId
          }
          label="Gruptan çıkar"
          onPress={() =>
            void runSessionWrite(async () => {
              const selectedExerciseId = supersetSelection[0];
              if (!selectedExerciseId) return;
              await repository.removeExerciseFromSessionSuperset(
                sessionId,
                selectedExerciseId
              );
              setSupersetSelection([]);
              await refreshSession();
            })
          }
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
            defaultEffortMode={workoutPreferences.workoutEffortMode}
            exercise={exercise}
            key={exercise.id}
            selected={session.selectedSessionExerciseId === exercise.id}
            weightUnit={workoutPreferences.weightUnit}
            onComplete={async (setId, weightKg, actualReps, metadata) => {
              await repository.completeSetAndPrefillNext(
                setId,
                weightKg,
                actualReps,
                metadata
              );
              await emitWorkoutHaptic(
                'set_completed',
                workoutPreferences.workoutHapticsEnabled
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
                savedSet.actualReps !== null &&
                savedSet.setType !== 'warm_up'
              ) {
                const volume = refreshedExercise.sets.reduce(
                  (total, item) =>
                    item.isCompleted &&
                    item.actualReps !== null &&
                    item.setType !== 'warm_up'
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
              const groupMembers = refreshed.exercises
                .filter(
                  (item) =>
                    exercise.supersetGroupId &&
                    item.supersetGroupId === exercise.supersetGroupId
                )
                .sort(
                  (left, right) =>
                    (left.supersetOrder ?? 0) - (right.supersetOrder ?? 0)
                );
              const startsRest = shouldStartRestAfterSet({
                completedSupersetOrder: exercise.supersetOrder,
                groupMemberOrders: groupMembers.map(
                  (item) => item.supersetOrder ?? 0
                ),
              });
              if (startsRest) {
                await startRest(
                  exercise.restDurationSeconds ??
                    workoutPreferences.globalRestSeconds,
                  exercise.id
                );
              } else {
                const nextMember = groupMembers.find(
                  (item) =>
                    (item.supersetOrder ?? 0) > (exercise.supersetOrder ?? 0) &&
                    !item.isSkipped
                );
                if (nextMember) {
                  await repository.selectSessionExercise(
                    sessionId,
                    nextMember.id
                  );
                  await refreshSession();
                }
              }
            }}
            onOpenHistory={() =>
              router.push(
                `/workout/exercise/${exercise.exerciseId}/history` as Href
              )
            }
            onOpenEditor={() => setEditorExerciseId(exercise.id)}
            onNumericGestureActiveChange={setNumericGestureActive}
            onMove={(direction) =>
              void runSessionWrite(async () => {
                await repository.reorderSessionExercise(
                  sessionId,
                  exercise.id,
                  direction
                );
                await refreshSession();
              })
            }
            onRemove={() =>
              Alert.alert(
                'Hareketi kaldır',
                `${exercise.name} yalnızca bu aktif antrenmandan kaldırılacak.`,
                [
                  { style: 'cancel', text: 'Vazgeç' },
                  {
                    style: 'destructive',
                    text: 'Kaldır',
                    onPress: () =>
                      void runSessionWrite(async () => {
                        await repository.removeUnstartedExercise(exercise.id);
                        await refreshSession();
                      }),
                  },
                ]
              )
            }
            onRestDurationChange={(seconds) =>
              void runSessionWrite(async () => {
                await repository.updateExerciseRestDuration(
                  exercise.id,
                  seconds
                );
                await refreshSession();
              })
            }
            onReplace={() =>
              void runSessionWrite(() => openExerciseManager(exercise))
            }
            onSkip={() =>
              void runSessionWrite(async () => {
                await repository.setExerciseSkipped(
                  exercise.id,
                  !exercise.isSkipped
                );
                await refreshSession();
              })
            }
            onSupersetToggle={() =>
              setSupersetSelection((current) =>
                current.includes(exercise.id)
                  ? current.filter((id) => id !== exercise.id)
                  : [...current, exercise.id]
              )
            }
            previousPerformance={previous.get(exercise.exerciseId) ?? null}
            previousPerformanceError={performanceError}
            previousPerformanceLoading={performanceLoading}
            supersetSelected={supersetSelection.includes(exercise.id)}
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
        onSaveSet={async (setId, weightKg, actualReps, metadata) => {
          await repository.updateCompletedSet(
            setId,
            weightKg,
            actualReps,
            metadata.setType,
            metadata.effortMode,
            metadata.effortValue
          );
          await refreshSession();
        }}
        onUndoSet={async (setId) => {
          await repository.undoCompletedSet(setId);
          await cancelRestTimerNotification(
            session.restTimer?.notificationIdentifier
          );
          if (session.restTimer) await repository.cancelRestTimer(sessionId);
          await emitWorkoutHaptic(
            'set_undone',
            workoutPreferences.workoutHapticsEnabled
          );
          await refreshSession();
          AccessibilityInfo.announceForAccessibility(
            'Set tamamlaması geri alındı.'
          );
        }}
        visible={editorExercise !== null}
      />
      <ActiveExerciseManager
        exercises={availableExercises}
        onClose={() => {
          setExerciseManagerVisible(false);
          setReplaceTarget(null);
        }}
        onSelect={(exerciseId) =>
          void runSessionWrite(async () => {
            if (replaceTarget) {
              await repository.replaceUnstartedExercise(
                replaceTarget.id,
                exerciseId
              );
            } else {
              await repository.addExerciseToSession(sessionId, exerciseId);
            }
            setExerciseManagerVisible(false);
            setReplaceTarget(null);
            await refreshSession();
          })
        }
        pending={sessionPending}
        replaceTarget={replaceTarget}
        visible={exerciseManagerVisible}
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
  notesCard: {
    backgroundColor: workoutTheme.surface,
    borderRadius: theme.radii.md,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  screenContent: { gap: theme.spacing.md, paddingHorizontal: theme.spacing.sm },
  sessionAction: { flex: 1, minHeight: theme.layout.compactTouchTarget },
  sessionActions: { flexDirection: 'row', gap: theme.spacing.sm },
  supersetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
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
