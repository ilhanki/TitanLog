import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

import type {
  CompletedWorkoutDetail,
  CompletedWorkoutHistoryItem,
  CompletedWorkoutSummary,
  AvailableExercise,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionStatus,
  WorkoutSet,
  WorkoutEffortMode,
  WorkoutSetType,
  WeightMode,
} from '@/features/workouts/domain/models';
import {
  calculateWorkoutDurationMinutes,
  createCompletedWorkoutDetail,
} from '@/features/workouts/utils/workout-history';
import {
  calculateSessionMetrics,
  canCompleteSet,
} from '@/features/workouts/utils/workout-values';
import {
  adjustRestTimerDeadline,
  createRestTimerState,
} from '@/features/workouts/domain/rest-timer';
import {
  isWorkoutSetType,
  validateEffort,
} from '@/features/workouts/domain/set-policy';

type SessionRow = {
  cancelled_at: string | null;
  completed_at: string | null;
  id: number;
  notes: string;
  rest_timer_alerted_at: string | null;
  rest_timer_deadline: string | null;
  rest_timer_duration_seconds: number | null;
  rest_timer_exercise_id: number | null;
  rest_timer_notification_id: string | null;
  selected_session_exercise_id: number | null;
  started_at: string;
  status: WorkoutSessionStatus;
  workout_day_id: number;
  workout_name_snapshot: string;
};

type SessionExerciseRow = {
  exercise_id: number;
  exercise_name_snapshot: string;
  id: number;
  is_skipped: number;
  muscle_group_snapshot: string;
  sort_order: number;
  rest_duration_seconds: number;
  superset_group_id: string | null;
  superset_order: number | null;
  weight_mode_snapshot: WeightMode;
};

type SetRow = {
  actual_reps: number | null;
  completed_at: string | null;
  id: number;
  is_completed: number;
  effort_mode: 'rpe' | 'rir' | null;
  effort_value: number | null;
  set_type: WorkoutSet['setType'];
  set_number: number;
  target_reps: number;
  weight_kg: number;
};

type ActiveSetRow = SetRow & { session_exercise_id: number };

type DayExerciseRow = {
  default_rest_seconds: number;
  default_set_count: number;
  default_target_reps: number;
  default_weight_kg: number;
  exercise_id: number;
  muscle_group: string;
  name: string;
  sort_order: number;
  superset_group_id: string | null;
  superset_order: number | null;
  weight_mode: WeightMode;
};

type ActiveDayRow = { id: number; name: string };

type CompletedHistoryRow = {
  completed_at: string;
  completed_set_count: number;
  id: number;
  started_at: string;
  total_repetitions: number;
  total_volume: number;
  workout_day_id: number;
  workout_name_snapshot: string;
};

type RecentCompletedRow = CompletedHistoryRow & {
  exercise_names: string | null;
};

export type WorkoutSessionErrorCode =
  | 'day_not_found'
  | 'day_has_no_exercises'
  | 'exercise_not_found'
  | 'exercise_not_removable'
  | 'invalid_set'
  | 'invalid_rest_duration'
  | 'invalid_superset'
  | 'no_completed_sets'
  | 'session_not_completed'
  | 'session_not_active'
  | 'set_already_completed'
  | 'set_not_removable'
  | 'reorder_unavailable';

export class WorkoutSessionError extends Error {
  constructor(readonly code: WorkoutSessionErrorCode) {
    super(code);
  }
}

function mapSet(row: SetRow): WorkoutSet {
  return {
    actualReps: row.actual_reps,
    completedAt: row.completed_at,
    id: row.id,
    isCompleted: row.is_completed === 1,
    effortMode: row.effort_mode,
    effortValue: row.effort_value,
    setType: row.set_type,
    setNumber: row.set_number,
    targetReps: row.target_reps,
    weightKg: row.weight_kg,
  };
}

export function createWorkoutSessionRepository(database: SQLiteDatabase) {
  async function getSessionDetails(
    sessionId: number
  ): Promise<WorkoutSession | null> {
    const session = await database.getFirstAsync<SessionRow>(
      `SELECT id, workout_day_id, workout_name_snapshot, status, started_at,
              completed_at, cancelled_at, rest_timer_deadline,
              rest_timer_duration_seconds, rest_timer_exercise_id,
              rest_timer_alerted_at, rest_timer_notification_id,
              selected_session_exercise_id, notes
       FROM workout_sessions
       WHERE id = ?`,
      sessionId
    );
    if (!session) return null;

    const exerciseRows = await database.getAllAsync<SessionExerciseRow>(
      `SELECT id, exercise_id, exercise_name_snapshot, muscle_group_snapshot,
              weight_mode_snapshot, sort_order, rest_duration_seconds,
              superset_group_id, superset_order, is_skipped
       FROM workout_session_exercises
       WHERE session_id = ?
       ORDER BY sort_order`,
      sessionId
    );
    const setRows = await database.getAllAsync<
      SetRow & { session_exercise_id: number }
    >(
      `SELECT workout_set.id, workout_set.session_exercise_id,
              workout_set.set_number, workout_set.target_reps,
              workout_set.actual_reps, workout_set.weight_kg,
              workout_set.is_completed, workout_set.completed_at,
              workout_set.set_type, workout_set.effort_mode,
              workout_set.effort_value
       FROM workout_sets AS workout_set
       JOIN workout_session_exercises AS owner
         ON owner.id = workout_set.session_exercise_id
       WHERE owner.session_id = ?
       ORDER BY workout_set.session_exercise_id, workout_set.set_number`,
      sessionId
    );
    const setsByExercise = new Map<number, WorkoutSet[]>();
    for (const row of setRows) {
      const ownerId =
        row.session_exercise_id ??
        (exerciseRows.length === 1 ? exerciseRows[0]!.id : -1);
      const sets = setsByExercise.get(ownerId) ?? [];
      sets.push(mapSet(row));
      setsByExercise.set(ownerId, sets);
    }
    const exercises: WorkoutSessionExercise[] = exerciseRows.map(
      (exercise) => ({
        exerciseId: exercise.exercise_id,
        id: exercise.id,
        isSkipped: exercise.is_skipped === 1,
        muscleGroup: exercise.muscle_group_snapshot,
        name: exercise.exercise_name_snapshot,
        restDurationSeconds: exercise.rest_duration_seconds,
        sets: setsByExercise.get(exercise.id) ?? [],
        sortOrder: exercise.sort_order,
        supersetGroupId: exercise.superset_group_id,
        supersetOrder: exercise.superset_order,
        weightMode: exercise.weight_mode_snapshot,
      })
    );

    return {
      cancelledAt: session.cancelled_at,
      completedAt: session.completed_at,
      exercises,
      id: session.id,
      notes: session.notes,
      restTimer:
        session.rest_timer_deadline && session.rest_timer_duration_seconds
          ? {
              alertedAt: session.rest_timer_alerted_at,
              deadline: session.rest_timer_deadline,
              durationSeconds: session.rest_timer_duration_seconds,
              notificationIdentifier: session.rest_timer_notification_id,
              sessionExerciseId: session.rest_timer_exercise_id,
            }
          : null,
      selectedSessionExerciseId: session.selected_session_exercise_id,
      startedAt: session.started_at,
      status: session.status,
      workoutDayId: session.workout_day_id,
      workoutName: session.workout_name_snapshot,
    };
  }

  async function getCompletedSummary(
    sessionId: number
  ): Promise<CompletedWorkoutSummary | null> {
    const session = await getSessionDetails(sessionId);
    if (!session || session.status !== 'completed' || !session.completedAt) {
      return null;
    }
    const metrics = calculateSessionMetrics(session);
    const comparison = await database.getFirstAsync<{
      personal_record_count: number | null;
      previous_volume: number | null;
    }>(
      `WITH current_exercise AS (
         SELECT exercise.exercise_id,
                MAX(workout_set.weight_kg) AS highest_weight,
                MAX(workout_set.actual_reps) AS highest_repetitions,
                SUM(workout_set.weight_kg * workout_set.actual_reps) AS volume
         FROM workout_session_exercises AS exercise
         JOIN workout_sets AS workout_set
           ON workout_set.session_exercise_id = exercise.id
         WHERE exercise.session_id = ? AND workout_set.is_completed = 1
           AND workout_set.actual_reps IS NOT NULL
           AND COALESCE(workout_set.set_type, 'working') <> 'warm_up'
         GROUP BY exercise.exercise_id
       ), historical_exercise AS (
         SELECT exercise.exercise_id, session.id,
                MAX(workout_set.weight_kg) AS highest_weight,
                MAX(workout_set.actual_reps) AS highest_repetitions,
                SUM(workout_set.weight_kg * workout_set.actual_reps) AS volume
         FROM workout_session_exercises AS exercise
         JOIN workout_sessions AS session ON session.id = exercise.session_id
         JOIN workout_sets AS workout_set
           ON workout_set.session_exercise_id = exercise.id
         WHERE session.status = 'completed' AND session.id <> ?
           AND session.completed_at < ? AND workout_set.is_completed = 1
           AND workout_set.actual_reps IS NOT NULL
           AND COALESCE(workout_set.set_type, 'working') <> 'warm_up'
         GROUP BY exercise.exercise_id, session.id
       ), record_totals AS (
         SELECT current.exercise_id,
                CASE WHEN MAX(history.highest_weight) IS NOT NULL
                           AND current.highest_weight > MAX(history.highest_weight)
                     THEN 1 ELSE 0 END +
                CASE WHEN MAX(history.highest_repetitions) IS NOT NULL
                           AND current.highest_repetitions > MAX(history.highest_repetitions)
                     THEN 1 ELSE 0 END +
                CASE WHEN MAX(history.volume) IS NOT NULL
                           AND current.volume > MAX(history.volume)
                     THEN 1 ELSE 0 END AS record_count
         FROM current_exercise AS current
         LEFT JOIN historical_exercise AS history
           ON history.exercise_id = current.exercise_id
         GROUP BY current.exercise_id
       ), previous_session AS (
         SELECT id FROM workout_sessions
         WHERE status = 'completed' AND workout_day_id = ? AND id <> ?
           AND completed_at < ? ORDER BY completed_at DESC, id DESC LIMIT 1
       )
       SELECT COALESCE((SELECT SUM(record_count) FROM record_totals), 0)
                AS personal_record_count,
              (SELECT SUM(workout_set.weight_kg * workout_set.actual_reps)
               FROM previous_session
               JOIN workout_session_exercises AS exercise
                 ON exercise.session_id = previous_session.id
               JOIN workout_sets AS workout_set
                 ON workout_set.session_exercise_id = exercise.id
               WHERE workout_set.is_completed = 1
                 AND workout_set.actual_reps IS NOT NULL
                 AND COALESCE(workout_set.set_type, 'working') <> 'warm_up')
                AS previous_volume`,
      session.id,
      session.id,
      session.completedAt,
      session.workoutDayId,
      session.id,
      session.completedAt
    );
    return {
      completedAt: session.completedAt,
      averageEffort: metrics.averageEffort,
      averageEffortMode: metrics.averageEffortMode,
      completedSetCount: metrics.completedSetCount,
      durationMinutes: calculateWorkoutDurationMinutes(
        session.startedAt,
        session.completedAt
      ),
      exerciseCount: metrics.completedExerciseCount,
      exerciseNames: session.exercises
        .filter((exercise) =>
          exercise.sets.some(
            (set) => set.isCompleted && (set.setType ?? 'working') !== 'warm_up'
          )
        )
        .slice(0, 6)
        .map((item) => item.name),
      id: session.id,
      personalRecordCount: comparison?.personal_record_count ?? 0,
      previousWorkoutVolume: comparison?.previous_volume ?? null,
      startedAt: session.startedAt,
      totalRepetitions: metrics.totalRepetitions,
      totalVolume: metrics.totalVolume,
      warmUpSetCount: metrics.warmUpSetCount,
      workoutDayId: session.workoutDayId,
      workoutName: session.workoutName,
    };
  }

  return {
    async getActiveSession(): Promise<WorkoutSession | null> {
      const row = await database.getFirstAsync<{ id: number }>(
        `SELECT id FROM workout_sessions
         WHERE status = 'active'
         LIMIT 1`
      );
      return row ? getSessionDetails(row.id) : null;
    },

    getSessionDetails,

    async startSessionFromWorkoutDay(
      workoutDayId: number
    ): Promise<WorkoutSession> {
      let sessionId: number | null = null;
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const active = await transaction.getFirstAsync<{ id: number }>(
          `SELECT id FROM workout_sessions
           WHERE status = 'active'
           LIMIT 1`
        );
        if (active) {
          sessionId = active.id;
          return;
        }

        const day = await transaction.getFirstAsync<ActiveDayRow>(
          `SELECT wd.id, wd.name
           FROM workout_days AS wd
           JOIN workout_plans AS wp ON wp.id = wd.plan_id
           WHERE wd.id = ? AND wp.is_active = 1`,
          workoutDayId
        );
        if (!day) throw new WorkoutSessionError('day_not_found');

        const exercises = await transaction.getAllAsync<DayExerciseRow>(
          `SELECT e.id AS exercise_id, e.name,
                  e.muscle_group, wde.sort_order, wde.default_set_count,
                  wde.default_target_reps, wde.default_weight_kg,
                  wde.weight_mode, wde.default_rest_seconds,
                  wde.superset_group_id, wde.superset_order
           FROM workout_day_exercises AS wde
           JOIN exercises AS e ON e.id = wde.exercise_id
           WHERE wde.workout_day_id = ?
           ORDER BY wde.sort_order`,
          workoutDayId
        );
        if (exercises.length === 0) {
          throw new WorkoutSessionError('day_has_no_exercises');
        }

        const timestamp = new Date().toISOString();
        const result = await transaction.runAsync(
          `INSERT INTO workout_sessions
            (workout_day_id, workout_name_snapshot, status, started_at,
             created_at, updated_at)
           VALUES (?, ?, 'active', ?, ?, ?)`,
          workoutDayId,
          day.name,
          timestamp,
          timestamp,
          timestamp
        );
        sessionId = result.lastInsertRowId;

        for (const exercise of exercises) {
          const snapshot = await transaction.runAsync(
            `INSERT INTO workout_session_exercises
              (session_id, exercise_id, exercise_name_snapshot,
               muscle_group_snapshot, weight_mode_snapshot, sort_order,
               created_at, rest_duration_seconds, superset_group_id,
               superset_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            sessionId,
            exercise.exercise_id,
            exercise.name,
            exercise.muscle_group,
            exercise.weight_mode,
            exercise.sort_order,
            timestamp,
            exercise.default_rest_seconds ?? 90,
            exercise.superset_group_id ?? null,
            exercise.superset_order ?? null
          );

          for (
            let setNumber = 1;
            setNumber <= exercise.default_set_count;
            setNumber++
          ) {
            await transaction.runAsync(
              `INSERT INTO workout_sets
                (session_exercise_id, set_number, target_reps, actual_reps,
                 weight_kg, is_completed, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
              snapshot.lastInsertRowId,
              setNumber,
              exercise.default_target_reps,
              exercise.default_target_reps,
              exercise.default_weight_kg,
              timestamp,
              timestamp
            );
          }
        }
      });

      if (sessionId === null) {
        throw new WorkoutSessionError('session_not_active');
      }
      const session = await getSessionDetails(sessionId);
      if (!session) throw new WorkoutSessionError('session_not_active');
      return session;
    },

    async updateSetValues(
      setId: number,
      weightKg: number,
      actualReps: number | null
    ): Promise<void> {
      const timestamp = new Date().toISOString();
      const result = await database.runAsync(
        `UPDATE workout_sets
         SET weight_kg = ?, actual_reps = ?, updated_at = ?
         WHERE id = ?
           AND session_exercise_id IN (
             SELECT wse.id FROM workout_session_exercises AS wse
             JOIN workout_sessions AS ws ON ws.id = wse.session_id
             WHERE ws.status = 'active'
           )`,
        weightKg,
        actualReps,
        timestamp,
        setId
      );
      if (result.changes !== 1) {
        throw new WorkoutSessionError('session_not_active');
      }
    },

    async completeSetAndPrefillNext(
      setId: number,
      weightKg: number,
      actualReps: number,
      metadata: {
        effortMode?: Exclude<WorkoutEffortMode, 'off'> | null;
        effortValue?: number | null;
        setType?: WorkoutSetType;
      } = {}
    ): Promise<void> {
      if (!canCompleteSet({ actualReps, weightKg })) {
        throw new WorkoutSessionError('invalid_set');
      }
      const setType = metadata.setType ?? 'working';
      const effortMode = metadata.effortMode ?? null;
      const effortValue = metadata.effortValue ?? null;
      if (
        !isWorkoutSetType(setType) ||
        !validateEffort(effortMode ?? 'off', effortValue)
      ) {
        throw new WorkoutSessionError('invalid_set');
      }
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const row = await transaction.getFirstAsync<ActiveSetRow>(
          `SELECT ws.id, ws.session_exercise_id, ws.set_number,
                  ws.target_reps, ws.actual_reps, ws.weight_kg,
                  ws.is_completed, ws.completed_at
           FROM workout_sets AS ws
           JOIN workout_session_exercises AS wse
             ON wse.id = ws.session_exercise_id
           JOIN workout_sessions AS session ON session.id = wse.session_id
           WHERE ws.id = ? AND session.status = 'active'`,
          setId
        );
        if (!row) throw new WorkoutSessionError('session_not_active');
        if (row.is_completed === 1) {
          throw new WorkoutSessionError('set_already_completed');
        }

        const timestamp = new Date().toISOString();
        const result = await transaction.runAsync(
          `UPDATE workout_sets
           SET weight_kg = ?, actual_reps = ?, is_completed = 1,
               completed_at = ?, updated_at = ?, set_type = ?,
               effort_mode = ?, effort_value = ?
           WHERE id = ? AND is_completed = 0`,
          weightKg,
          actualReps,
          timestamp,
          timestamp,
          setType,
          effortMode,
          effortValue,
          setId
        );
        if (result.changes !== 1) {
          throw new WorkoutSessionError('set_already_completed');
        }

        const nextSet = await transaction.getFirstAsync<{ id: number }>(
          `SELECT id FROM workout_sets
           WHERE session_exercise_id = ?
             AND set_number > ?
             AND is_completed = 0
           ORDER BY set_number
           LIMIT 1`,
          row.session_exercise_id,
          row.set_number
        );
        if (nextSet) {
          await transaction.runAsync(
            `UPDATE workout_sets
             SET weight_kg = ?, actual_reps = ?, updated_at = ?
             WHERE id = ? AND is_completed = 0`,
            weightKg,
            actualReps,
            timestamp,
            nextSet.id
          );
        }
      });
    },

    async updateSetMetadata(
      setId: number,
      setType: WorkoutSetType,
      effortMode: WorkoutEffortMode,
      effortValue: number | null
    ): Promise<void> {
      if (
        !isWorkoutSetType(setType) ||
        !validateEffort(effortMode, effortValue)
      )
        throw new WorkoutSessionError('invalid_set');
      const result = await database.runAsync(
        `UPDATE workout_sets
         SET set_type = ?, effort_mode = ?, effort_value = ?, updated_at = ?
         WHERE id = ? AND is_completed = 0
           AND session_exercise_id IN (
             SELECT exercise.id FROM workout_session_exercises AS exercise
             JOIN workout_sessions AS session ON session.id = exercise.session_id
             WHERE session.status = 'active'
           )`,
        setType,
        effortMode === 'off' ? null : effortMode,
        effortMode === 'off' ? null : effortValue,
        new Date().toISOString(),
        setId
      );
      if (result.changes !== 1)
        throw new WorkoutSessionError('session_not_active');
    },

    async updateCompletedSet(
      setId: number,
      weightKg: number,
      actualReps: number,
      setType: WorkoutSetType,
      effortMode: WorkoutEffortMode,
      effortValue: number | null
    ): Promise<void> {
      if (
        !canCompleteSet({ actualReps, weightKg }) ||
        !isWorkoutSetType(setType) ||
        !validateEffort(effortMode, effortValue)
      )
        throw new WorkoutSessionError('invalid_set');
      const result = await database.runAsync(
        `UPDATE workout_sets
         SET weight_kg = ?, actual_reps = ?, set_type = ?, effort_mode = ?,
             effort_value = ?, updated_at = ?
         WHERE id = ? AND is_completed = 1
           AND session_exercise_id IN (
             SELECT exercise.id FROM workout_session_exercises AS exercise
             JOIN workout_sessions AS session ON session.id = exercise.session_id
             WHERE session.status = 'active'
           )`,
        weightKg,
        actualReps,
        setType,
        effortMode === 'off' ? null : effortMode,
        effortMode === 'off' ? null : effortValue,
        new Date().toISOString(),
        setId
      );
      if (result.changes !== 1)
        throw new WorkoutSessionError('session_not_active');
    },

    async undoCompletedSet(setId: number): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const result = await transaction.runAsync(
          `UPDATE workout_sets
           SET is_completed = 0, completed_at = NULL, updated_at = ?
           WHERE id = ? AND is_completed = 1
             AND session_exercise_id IN (
               SELECT exercise.id FROM workout_session_exercises AS exercise
               JOIN workout_sessions AS session ON session.id = exercise.session_id
               WHERE session.status = 'active'
             )`,
          new Date().toISOString(),
          setId
        );
        if (result.changes !== 1)
          throw new WorkoutSessionError('session_not_active');
      });
    },

    async startRestTimer(
      sessionId: number,
      durationSeconds: number,
      sessionExerciseId: number | null,
      notificationIdentifier: string | null,
      now = Date.now()
    ) {
      const timer = createRestTimerState(
        durationSeconds,
        now,
        sessionExerciseId,
        notificationIdentifier
      );
      const result = await database.runAsync(
        `UPDATE workout_sessions
         SET rest_timer_deadline = ?, rest_timer_duration_seconds = ?,
             rest_timer_exercise_id = ?, rest_timer_alerted_at = NULL,
             rest_timer_notification_id = ?, updated_at = ?
         WHERE id = ? AND status = 'active'`,
        timer.deadline,
        timer.durationSeconds,
        timer.sessionExerciseId,
        timer.notificationIdentifier,
        new Date(now).toISOString(),
        sessionId
      );
      if (result.changes !== 1)
        throw new WorkoutSessionError('session_not_active');
      return timer;
    },

    async adjustRestTimer(
      sessionId: number,
      deltaSeconds: number,
      now = Date.now()
    ) {
      const session = await getSessionDetails(sessionId);
      if (!session || session.status !== 'active' || !session.restTimer)
        throw new WorkoutSessionError('session_not_active');
      const adjusted = adjustRestTimerDeadline(
        session.restTimer,
        deltaSeconds,
        now
      );
      if (!adjusted) {
        const result = await database.runAsync(
          `UPDATE workout_sessions
           SET rest_timer_deadline = NULL, rest_timer_duration_seconds = NULL,
               rest_timer_exercise_id = NULL, rest_timer_alerted_at = NULL,
               rest_timer_notification_id = NULL, updated_at = ?
           WHERE id = ? AND status = 'active'`,
          new Date(now).toISOString(),
          sessionId
        );
        if (result.changes !== 1)
          throw new WorkoutSessionError('session_not_active');
        return null;
      }
      const result = await database.runAsync(
        `UPDATE workout_sessions
         SET rest_timer_deadline = ?, rest_timer_duration_seconds = ?,
             rest_timer_alerted_at = NULL, rest_timer_notification_id = NULL,
             updated_at = ?
         WHERE id = ? AND status = 'active'`,
        adjusted.deadline,
        adjusted.durationSeconds,
        new Date(now).toISOString(),
        sessionId
      );
      if (result.changes !== 1)
        throw new WorkoutSessionError('session_not_active');
      return adjusted;
    },

    async cancelRestTimer(sessionId: number): Promise<void> {
      const result = await database.runAsync(
        `UPDATE workout_sessions
         SET rest_timer_deadline = NULL, rest_timer_duration_seconds = NULL,
             rest_timer_exercise_id = NULL, rest_timer_alerted_at = NULL,
             rest_timer_notification_id = NULL, updated_at = ?
         WHERE id = ? AND status = 'active'`,
        new Date().toISOString(),
        sessionId
      );
      if (result.changes !== 1)
        throw new WorkoutSessionError('session_not_active');
    },

    async markRestTimerAlerted(
      sessionId: number,
      alertedAt: string
    ): Promise<boolean> {
      const result = await database.runAsync(
        `UPDATE workout_sessions
         SET rest_timer_alerted_at = ?, updated_at = ?
         WHERE id = ? AND status = 'active' AND rest_timer_deadline IS NOT NULL
           AND rest_timer_alerted_at IS NULL`,
        alertedAt,
        alertedAt,
        sessionId
      );
      return result.changes === 1;
    },

    async setRestTimerNotificationIdentifier(
      sessionId: number,
      identifier: string | null
    ): Promise<void> {
      const result = await database.runAsync(
        `UPDATE workout_sessions
         SET rest_timer_notification_id = ?, updated_at = ?
         WHERE id = ? AND status = 'active' AND rest_timer_deadline IS NOT NULL`,
        identifier,
        new Date().toISOString(),
        sessionId
      );
      if (result.changes !== 1)
        throw new WorkoutSessionError('session_not_active');
    },

    async toggleSetCompletion(setId: number): Promise<void> {
      const row = await database.getFirstAsync<SetRow>(
        `SELECT ws.id, ws.set_number, ws.target_reps, ws.actual_reps,
                ws.weight_kg, ws.is_completed, ws.completed_at
         FROM workout_sets AS ws
         JOIN workout_session_exercises AS wse ON wse.id = ws.session_exercise_id
         JOIN workout_sessions AS session ON session.id = wse.session_id
         WHERE ws.id = ? AND session.status = 'active'`,
        setId
      );
      if (!row) throw new WorkoutSessionError('session_not_active');
      const workoutSet = mapSet(row);
      const shouldComplete = !workoutSet.isCompleted;
      if (shouldComplete && !canCompleteSet(workoutSet)) {
        throw new WorkoutSessionError('invalid_set');
      }
      const timestamp = new Date().toISOString();
      await database.runAsync(
        `UPDATE workout_sets
         SET is_completed = ?, completed_at = ?, updated_at = ?
         WHERE id = ?`,
        shouldComplete ? 1 : 0,
        shouldComplete ? timestamp : null,
        timestamp,
        setId
      );
    },

    async addSet(sessionExerciseId: number): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const lastSet = await transaction.getFirstAsync<SetRow>(
          `SELECT ws.id, ws.set_number, ws.target_reps, ws.actual_reps,
                  ws.weight_kg, ws.is_completed, ws.completed_at
           FROM workout_sets AS ws
           JOIN workout_session_exercises AS wse ON wse.id = ws.session_exercise_id
           JOIN workout_sessions AS session ON session.id = wse.session_id
           WHERE ws.session_exercise_id = ? AND session.status = 'active'
           ORDER BY ws.set_number DESC
           LIMIT 1`,
          sessionExerciseId
        );
        if (!lastSet) throw new WorkoutSessionError('session_not_active');
        const timestamp = new Date().toISOString();
        await transaction.runAsync(
          `INSERT INTO workout_sets
            (session_exercise_id, set_number, target_reps, actual_reps,
             weight_kg, is_completed, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
          sessionExerciseId,
          lastSet.set_number + 1,
          lastSet.target_reps,
          lastSet.actual_reps ?? lastSet.target_reps,
          lastSet.weight_kg,
          timestamp,
          timestamp
        );
      });
    },

    async removeLastIncompleteSet(sessionExerciseId: number): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const rows = await transaction.getAllAsync<SetRow>(
          `SELECT ws.id, ws.set_number, ws.target_reps, ws.actual_reps,
                  ws.weight_kg, ws.is_completed, ws.completed_at
           FROM workout_sets AS ws
           JOIN workout_session_exercises AS wse ON wse.id = ws.session_exercise_id
           JOIN workout_sessions AS session ON session.id = wse.session_id
           WHERE ws.session_exercise_id = ? AND session.status = 'active'
           ORDER BY ws.set_number`,
          sessionExerciseId
        );
        const lastSet = rows.at(-1);
        if (rows.length <= 1 || !lastSet || lastSet.is_completed === 1) {
          throw new WorkoutSessionError('set_not_removable');
        }
        await transaction.runAsync(
          'DELETE FROM workout_sets WHERE id = ?',
          lastSet.id
        );
      });
    },

    async setExerciseSkipped(
      sessionExerciseId: number,
      skipped: boolean
    ): Promise<void> {
      const result = await database.runAsync(
        `UPDATE workout_session_exercises
         SET is_skipped = ?
         WHERE id = ? AND session_id IN (
           SELECT id FROM workout_sessions WHERE status = 'active'
         )`,
        skipped ? 1 : 0,
        sessionExerciseId
      );
      if (result.changes !== 1)
        throw new WorkoutSessionError('session_not_active');
    },

    async selectSessionExercise(
      sessionId: number,
      sessionExerciseId: number
    ): Promise<void> {
      const result = await database.runAsync(
        `UPDATE workout_sessions
         SET selected_session_exercise_id = ?, updated_at = ?
         WHERE id = ? AND status = 'active'
           AND EXISTS (
             SELECT 1 FROM workout_session_exercises
             WHERE id = ? AND session_id = workout_sessions.id
           )`,
        sessionExerciseId,
        new Date().toISOString(),
        sessionId,
        sessionExerciseId
      );
      if (result.changes !== 1)
        throw new WorkoutSessionError('session_not_active');
    },

    async updateExerciseRestDuration(
      sessionExerciseId: number,
      durationSeconds: number
    ): Promise<void> {
      if (
        !Number.isSafeInteger(durationSeconds) ||
        durationSeconds < 15 ||
        durationSeconds > 1800
      )
        throw new WorkoutSessionError('invalid_rest_duration');
      const result = await database.runAsync(
        `UPDATE workout_session_exercises
         SET rest_duration_seconds = ?
         WHERE id = ? AND session_id IN (
           SELECT id FROM workout_sessions WHERE status = 'active'
         )`,
        durationSeconds,
        sessionExerciseId
      );
      if (result.changes !== 1)
        throw new WorkoutSessionError('session_not_active');
    },

    async updateSessionNotes(sessionId: number, notes: string): Promise<void> {
      const normalized = notes.trim().slice(0, 500);
      const result = await database.runAsync(
        `UPDATE workout_sessions SET notes = ?, updated_at = ?
         WHERE id = ? AND status = 'active'`,
        normalized,
        new Date().toISOString(),
        sessionId
      );
      if (result.changes !== 1)
        throw new WorkoutSessionError('session_not_active');
    },

    async reorderSessionExercise(
      sessionId: number,
      sessionExerciseId: number,
      direction: 'up' | 'down'
    ): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const rows = await transaction.getAllAsync<{ id: number }>(
          `SELECT exercise.id
           FROM workout_session_exercises AS exercise
           JOIN workout_sessions AS session ON session.id = exercise.session_id
           WHERE exercise.session_id = ? AND session.status = 'active'
           ORDER BY exercise.sort_order, exercise.id`,
          sessionId
        );
        const current = rows.findIndex((row) => row.id === sessionExerciseId);
        const target = direction === 'up' ? current - 1 : current + 1;
        if (current < 0 || target < 0 || target >= rows.length)
          throw new WorkoutSessionError('reorder_unavailable');
        const ordered = [...rows];
        [ordered[current], ordered[target]] = [
          ordered[target]!,
          ordered[current]!,
        ];
        for (const [index, row] of ordered.entries())
          await transaction.runAsync(
            'UPDATE workout_session_exercises SET sort_order = ? WHERE id = ?',
            -(index + 1),
            row.id
          );
        for (const [index, row] of ordered.entries())
          await transaction.runAsync(
            'UPDATE workout_session_exercises SET sort_order = ? WHERE id = ?',
            index + 1,
            row.id
          );
      });
    },

    async removeUnstartedExercise(sessionExerciseId: number): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const row = await transaction.getFirstAsync<{ session_id: number }>(
          `SELECT exercise.session_id
           FROM workout_session_exercises AS exercise
           JOIN workout_sessions AS session ON session.id = exercise.session_id
           WHERE exercise.id = ? AND session.status = 'active'
             AND NOT EXISTS (
               SELECT 1 FROM workout_sets AS workout_set
               WHERE workout_set.session_exercise_id = exercise.id
                 AND workout_set.is_completed = 1
             )`,
          sessionExerciseId
        );
        if (!row) throw new WorkoutSessionError('exercise_not_removable');
        await transaction.runAsync(
          'DELETE FROM workout_session_exercises WHERE id = ?',
          sessionExerciseId
        );
        const remaining = await transaction.getAllAsync<{ id: number }>(
          `SELECT id FROM workout_session_exercises
           WHERE session_id = ? ORDER BY sort_order, id`,
          row.session_id
        );
        for (const [index, item] of remaining.entries())
          await transaction.runAsync(
            'UPDATE workout_session_exercises SET sort_order = ? WHERE id = ?',
            index + 1,
            item.id
          );
        await transaction.runAsync(
          `UPDATE workout_session_exercises
           SET superset_group_id = NULL, superset_order = NULL
           WHERE session_id = ? AND superset_group_id IN (
             SELECT superset_group_id FROM workout_session_exercises
             WHERE session_id = ? AND superset_group_id IS NOT NULL
             GROUP BY superset_group_id HAVING COUNT(*) < 2
           )`,
          row.session_id,
          row.session_id
        );
      });
    },

    async getAvailableExercisesForSession(
      sessionId: number
    ): Promise<AvailableExercise[]> {
      const rows = await database.getAllAsync<{
        equipment: string;
        id: number;
        muscle_group: string;
        name: string;
      }>(
        `SELECT exercise.id, exercise.name, exercise.muscle_group, exercise.equipment
         FROM exercises AS exercise
         WHERE NOT EXISTS (
           SELECT 1 FROM workout_session_exercises AS linked
           WHERE linked.session_id = ? AND linked.exercise_id = exercise.id
         )
         AND EXISTS (SELECT 1 FROM workout_sessions WHERE id = ? AND status = 'active')
         ORDER BY exercise.name COLLATE NOCASE, exercise.id`,
        sessionId,
        sessionId
      );
      return rows.map((row) => ({
        equipment: row.equipment,
        id: row.id,
        muscleGroup: row.muscle_group,
        name: row.name,
      }));
    },

    async addExerciseToSession(
      sessionId: number,
      exerciseId: number
    ): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const row = await transaction.getFirstAsync<{
          default_rest_seconds: number | null;
          default_set_count: number | null;
          default_target_reps: number | null;
          default_weight_kg: number | null;
          equipment: string;
          muscle_group: string;
          name: string;
          weight_mode: WeightMode | null;
        }>(
          `SELECT exercise.name, exercise.muscle_group, exercise.equipment,
                  defaults.default_set_count, defaults.default_target_reps,
                  defaults.default_weight_kg, defaults.weight_mode,
                  defaults.default_rest_seconds
           FROM workout_sessions AS session
           JOIN exercises AS exercise ON exercise.id = ?
           LEFT JOIN workout_day_exercises AS defaults
             ON defaults.workout_day_id = session.workout_day_id
            AND defaults.exercise_id = exercise.id
           WHERE session.id = ? AND session.status = 'active'`,
          exerciseId,
          sessionId
        );
        if (!row) throw new WorkoutSessionError('exercise_not_found');
        const order = await transaction.getFirstAsync<{ next_order: number }>(
          `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
           FROM workout_session_exercises WHERE session_id = ?`,
          sessionId
        );
        const timestamp = new Date().toISOString();
        const inserted = await transaction.runAsync(
          `INSERT INTO workout_session_exercises
            (session_id, exercise_id, exercise_name_snapshot,
             muscle_group_snapshot, weight_mode_snapshot, sort_order,
             created_at, rest_duration_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          sessionId,
          exerciseId,
          row.name,
          row.muscle_group,
          row.weight_mode ?? 'total',
          order?.next_order ?? 1,
          timestamp,
          row.default_rest_seconds ?? 90
        );
        const setCount = row.default_set_count ?? 3;
        for (let setNumber = 1; setNumber <= setCount; setNumber++)
          await transaction.runAsync(
            `INSERT INTO workout_sets
              (session_exercise_id, set_number, target_reps, actual_reps,
               weight_kg, is_completed, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
            inserted.lastInsertRowId,
            setNumber,
            row.default_target_reps ?? 12,
            row.default_target_reps ?? 12,
            row.default_weight_kg ?? 0,
            timestamp,
            timestamp
          );
      });
    },

    async replaceUnstartedExercise(
      sessionExerciseId: number,
      exerciseId: number
    ): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const replacement = await transaction.getFirstAsync<{
          muscle_group: string;
          name: string;
        }>('SELECT name, muscle_group FROM exercises WHERE id = ?', exerciseId);
        if (!replacement) throw new WorkoutSessionError('exercise_not_found');
        const result = await transaction.runAsync(
          `UPDATE workout_session_exercises
           SET exercise_id = ?, exercise_name_snapshot = ?,
               muscle_group_snapshot = ?
           WHERE id = ? AND session_id IN (
             SELECT id FROM workout_sessions WHERE status = 'active'
           ) AND NOT EXISTS (
             SELECT 1 FROM workout_sets
             WHERE session_exercise_id = ? AND is_completed = 1
           )`,
          exerciseId,
          replacement.name,
          replacement.muscle_group,
          sessionExerciseId,
          sessionExerciseId
        );
        if (result.changes !== 1)
          throw new WorkoutSessionError('exercise_not_removable');
      });
    },

    async createSessionSuperset(
      sessionId: number,
      sessionExerciseIds: readonly number[]
    ): Promise<string> {
      const uniqueIds = [...new Set(sessionExerciseIds)];
      if (uniqueIds.length < 2)
        throw new WorkoutSessionError('exercise_not_found');
      const groupId = randomUUID();
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const rows = await transaction.getAllAsync<{ id: number }>(
          `SELECT exercise.id
           FROM workout_session_exercises AS exercise
           JOIN workout_sessions AS session ON session.id = exercise.session_id
           WHERE session.id = ? AND session.status = 'active'
             AND exercise.id IN (${uniqueIds.map(() => '?').join(', ')})
           ORDER BY exercise.sort_order, exercise.id`,
          sessionId,
          ...uniqueIds
        );
        if (rows.length !== uniqueIds.length)
          throw new WorkoutSessionError('exercise_not_found');
        for (const [order, row] of rows.entries())
          await transaction.runAsync(
            `UPDATE workout_session_exercises
             SET superset_group_id = ?, superset_order = ? WHERE id = ?`,
            groupId,
            order,
            row.id
          );
        await transaction.runAsync(
          `UPDATE workout_session_exercises
           SET superset_group_id = NULL, superset_order = NULL
           WHERE session_id = ? AND superset_group_id IN (
             SELECT superset_group_id FROM workout_session_exercises
             WHERE session_id = ? AND superset_group_id IS NOT NULL
             GROUP BY superset_group_id HAVING COUNT(*) < 2
           )`,
          sessionId,
          sessionId
        );
      });
      return groupId;
    },

    async dissolveSessionSuperset(
      sessionId: number,
      groupId: string
    ): Promise<void> {
      const result = await database.runAsync(
        `UPDATE workout_session_exercises
         SET superset_group_id = NULL, superset_order = NULL
         WHERE session_id = ? AND superset_group_id = ?
           AND session_id IN (SELECT id FROM workout_sessions WHERE status = 'active')`,
        sessionId,
        groupId
      );
      if (result.changes < 2)
        throw new WorkoutSessionError('exercise_not_found');
    },

    async removeExerciseFromSessionSuperset(
      sessionId: number,
      sessionExerciseId: number
    ): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const member = await transaction.getFirstAsync<{
          superset_group_id: string;
        }>(
          `SELECT exercise.superset_group_id
           FROM workout_session_exercises AS exercise
           JOIN workout_sessions AS session ON session.id = exercise.session_id
           WHERE exercise.id = ? AND exercise.session_id = ?
             AND session.status = 'active'
             AND exercise.superset_group_id IS NOT NULL`,
          sessionExerciseId,
          sessionId
        );
        if (!member) throw new WorkoutSessionError('invalid_superset');
        await transaction.runAsync(
          `UPDATE workout_session_exercises
           SET superset_group_id = NULL, superset_order = NULL
           WHERE id = ? AND session_id = ?`,
          sessionExerciseId,
          sessionId
        );
        await transaction.runAsync(
          `UPDATE workout_session_exercises
           SET superset_group_id = NULL, superset_order = NULL
           WHERE session_id = ? AND superset_group_id = ?
             AND (SELECT COUNT(*) FROM workout_session_exercises
                  WHERE session_id = ? AND superset_group_id = ?) < 2`,
          sessionId,
          member.superset_group_id,
          sessionId,
          member.superset_group_id
        );
      });
    },

    async completeSession(sessionId: number): Promise<CompletedWorkoutSummary> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const session = await transaction.getFirstAsync<{
          status: WorkoutSessionStatus;
        }>('SELECT status FROM workout_sessions WHERE id = ?', sessionId);
        if (session?.status === 'completed') return;
        if (session?.status !== 'active')
          throw new WorkoutSessionError('session_not_active');
        const completed = await transaction.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count
           FROM workout_sets AS ws
           JOIN workout_session_exercises AS wse ON wse.id = ws.session_exercise_id
           WHERE wse.session_id = ? AND ws.is_completed = 1`,
          sessionId
        );
        if (!completed || completed.count === 0) {
          throw new WorkoutSessionError('no_completed_sets');
        }
        const timestamp = new Date().toISOString();
        const result = await transaction.runAsync(
          `UPDATE workout_sessions
           SET status = 'completed', completed_at = ?, updated_at = ?
               , rest_timer_deadline = NULL, rest_timer_duration_seconds = NULL,
               rest_timer_exercise_id = NULL, rest_timer_alerted_at = NULL,
               rest_timer_notification_id = NULL
           WHERE id = ? AND status = 'active'`,
          timestamp,
          timestamp,
          sessionId
        );
        if (result.changes !== 1) {
          throw new WorkoutSessionError('session_not_active');
        }
      });
      const summary = await getCompletedSummary(sessionId);
      if (!summary) throw new WorkoutSessionError('session_not_active');
      return summary;
    },

    async cancelSession(sessionId: number): Promise<void> {
      const timestamp = new Date().toISOString();
      const result = await database.runAsync(
        `UPDATE workout_sessions
         SET status = 'cancelled', cancelled_at = ?, updated_at = ?
             , rest_timer_deadline = NULL, rest_timer_duration_seconds = NULL,
             rest_timer_exercise_id = NULL, rest_timer_alerted_at = NULL,
             rest_timer_notification_id = NULL
         WHERE id = ? AND status = 'active'`,
        timestamp,
        timestamp,
        sessionId
      );
      if (result.changes !== 1) {
        throw new WorkoutSessionError('session_not_active');
      }
    },

    async getCompletedWorkoutHistory(
      limit = 20,
      offset = 0
    ): Promise<CompletedWorkoutHistoryItem[]> {
      const safeLimit = Number.isSafeInteger(limit)
        ? Math.min(Math.max(limit, 1), 50)
        : 20;
      const safeOffset = Number.isSafeInteger(offset) ? Math.max(offset, 0) : 0;
      const rows = await database.getAllAsync<CompletedHistoryRow>(
        `SELECT session.id, session.workout_day_id,
                session.workout_name_snapshot, session.started_at,
                session.completed_at,
                COALESCE(SUM(CASE WHEN workout_set.is_completed = 1
                  AND COALESCE(workout_set.set_type, 'working') <> 'warm_up'
                  THEN 1 ELSE 0 END), 0)
                  AS completed_set_count,
                COALESCE(SUM(CASE
                  WHEN workout_set.is_completed = 1
                    AND COALESCE(workout_set.set_type, 'working') <> 'warm_up'
                    AND workout_set.actual_reps IS NOT NULL
                  THEN workout_set.actual_reps ELSE 0 END), 0)
                  AS total_repetitions,
                COALESCE(SUM(CASE
                  WHEN workout_set.is_completed = 1
                    AND COALESCE(workout_set.set_type, 'working') <> 'warm_up'
                    AND workout_set.actual_reps IS NOT NULL
                  THEN workout_set.weight_kg * workout_set.actual_reps
                  ELSE 0 END), 0) AS total_volume
         FROM workout_sessions AS session
         LEFT JOIN workout_session_exercises AS session_exercise
           ON session_exercise.session_id = session.id
         LEFT JOIN workout_sets AS workout_set
           ON workout_set.session_exercise_id = session_exercise.id
         WHERE session.status = 'completed' AND session.completed_at IS NOT NULL
         GROUP BY session.id
         ORDER BY session.completed_at DESC, session.id DESC
         LIMIT ? OFFSET ?`,
        safeLimit,
        safeOffset
      );
      return rows.map((row) => ({
        completedAt: row.completed_at,
        completedSetCount: row.completed_set_count,
        durationMinutes: calculateWorkoutDurationMinutes(
          row.started_at,
          row.completed_at
        ),
        id: row.id,
        startedAt: row.started_at,
        totalRepetitions: row.total_repetitions,
        totalVolume: row.total_volume,
        workoutDayId: row.workout_day_id,
        workoutName: row.workout_name_snapshot,
      }));
    },

    async getCompletedWorkoutDetail(
      sessionId: number
    ): Promise<CompletedWorkoutDetail | null> {
      const session = await getSessionDetails(sessionId);
      if (!session?.completedAt || session.status !== 'completed') return null;
      const previousRow = await database.getFirstAsync<{ id: number }>(
        `SELECT id FROM workout_sessions
         WHERE workout_day_id = ?
           AND status = 'completed'
           AND completed_at IS NOT NULL
           AND completed_at < ?
         ORDER BY completed_at DESC, id DESC
         LIMIT 1`,
        session.workoutDayId,
        session.completedAt
      );
      const previousSession = previousRow
        ? await getSessionDetails(previousRow.id)
        : null;
      return createCompletedWorkoutDetail(session, previousSession);
    },

    async deleteCompletedSession(sessionId: number): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const session = await transaction.getFirstAsync<{
          status: WorkoutSessionStatus;
        }>(
          `SELECT status FROM workout_sessions
           WHERE id = ?`,
          sessionId
        );
        if (session?.status !== 'completed') {
          throw new WorkoutSessionError('session_not_completed');
        }

        await transaction.runAsync(
          `DELETE FROM workout_sets
           WHERE session_exercise_id IN (
             SELECT id FROM workout_session_exercises WHERE session_id = ?
           )`,
          sessionId
        );
        await transaction.runAsync(
          'DELETE FROM workout_session_exercises WHERE session_id = ?',
          sessionId
        );
        const result = await transaction.runAsync(
          `DELETE FROM workout_sessions
           WHERE id = ? AND status = 'completed'`,
          sessionId
        );
        if (result.changes !== 1) {
          throw new WorkoutSessionError('session_not_completed');
        }
      });
    },

    async getRecentCompletedSessions(
      limit = 5
    ): Promise<CompletedWorkoutSummary[]> {
      const safeLimit = Number.isSafeInteger(limit)
        ? Math.min(Math.max(limit, 1), 10)
        : 5;
      const rows = await database.getAllAsync<RecentCompletedRow>(
        `WITH recent_sessions AS (
           SELECT id, workout_day_id, workout_name_snapshot, started_at,
                  completed_at
           FROM workout_sessions
           WHERE status = 'completed' AND completed_at IS NOT NULL
           ORDER BY completed_at DESC, id DESC
           LIMIT ?
         )
         SELECT session.id, session.workout_day_id,
                session.workout_name_snapshot, session.started_at,
                session.completed_at,
                COALESCE(SUM(CASE WHEN workout_set.is_completed = 1
                  AND COALESCE(workout_set.set_type, 'working') <> 'warm_up'
                  THEN 1 ELSE 0 END), 0)
                  AS completed_set_count,
                COALESCE(SUM(CASE
                  WHEN workout_set.is_completed = 1
                    AND COALESCE(workout_set.set_type, 'working') <> 'warm_up'
                    AND workout_set.actual_reps IS NOT NULL
                  THEN workout_set.actual_reps ELSE 0 END), 0)
                  AS total_repetitions,
                COALESCE(SUM(CASE
                  WHEN workout_set.is_completed = 1
                    AND COALESCE(workout_set.set_type, 'working') <> 'warm_up'
                    AND workout_set.actual_reps IS NOT NULL
                  THEN workout_set.weight_kg * workout_set.actual_reps
                  ELSE 0 END), 0) AS total_volume,
                (SELECT GROUP_CONCAT(name, char(31)) FROM (
                   SELECT exercise_name_snapshot AS name
                   FROM workout_session_exercises
                   WHERE session_id = session.id
                   ORDER BY sort_order, id
                   LIMIT 3
                 )) AS exercise_names
         FROM recent_sessions AS session
         LEFT JOIN workout_session_exercises AS session_exercise
           ON session_exercise.session_id = session.id
         LEFT JOIN workout_sets AS workout_set
           ON workout_set.session_exercise_id = session_exercise.id
         GROUP BY session.id
         ORDER BY session.completed_at DESC, session.id DESC`,
        safeLimit
      );
      return rows.map((row) => ({
        completedAt: row.completed_at,
        completedSetCount: row.completed_set_count,
        durationMinutes: calculateWorkoutDurationMinutes(
          row.started_at,
          row.completed_at
        ),
        exerciseNames: row.exercise_names?.split(String.fromCharCode(31)) ?? [],
        id: row.id,
        startedAt: row.started_at,
        totalRepetitions: row.total_repetitions,
        totalVolume: row.total_volume,
        workoutDayId: row.workout_day_id,
        workoutName: row.workout_name_snapshot,
      }));
    },

    async getCompletedSessionCount(): Promise<number> {
      const row = await database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM workout_sessions
         WHERE status = 'completed'`
      );
      return row?.count ?? 0;
    },

    getCompletedSummary,
  };
}

export type WorkoutSessionRepository = ReturnType<
  typeof createWorkoutSessionRepository
>;
