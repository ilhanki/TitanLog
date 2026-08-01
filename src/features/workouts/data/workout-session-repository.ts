import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  CompletedWorkoutDetail,
  CompletedWorkoutHistoryItem,
  CompletedWorkoutSummary,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionStatus,
  WorkoutSet,
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

type SessionRow = {
  cancelled_at: string | null;
  completed_at: string | null;
  id: number;
  started_at: string;
  status: WorkoutSessionStatus;
  workout_day_id: number;
  workout_name_snapshot: string;
};

type SessionExerciseRow = {
  exercise_id: number;
  exercise_name_snapshot: string;
  id: number;
  muscle_group_snapshot: string;
  sort_order: number;
  weight_mode_snapshot: WeightMode;
};

type SetRow = {
  actual_reps: number | null;
  completed_at: string | null;
  id: number;
  is_completed: number;
  set_number: number;
  target_reps: number;
  weight_kg: number;
};

type ActiveSetRow = SetRow & { session_exercise_id: number };

type DayExerciseRow = {
  default_set_count: number;
  default_target_reps: number;
  default_weight_kg: number;
  exercise_id: number;
  muscle_group: string;
  name: string;
  sort_order: number;
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
  | 'invalid_set'
  | 'no_completed_sets'
  | 'session_not_completed'
  | 'session_not_active'
  | 'set_already_completed'
  | 'set_not_removable';

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
              completed_at, cancelled_at
       FROM workout_sessions
       WHERE id = ?`,
      sessionId
    );
    if (!session) return null;

    const exerciseRows = await database.getAllAsync<SessionExerciseRow>(
      `SELECT id, exercise_id, exercise_name_snapshot, muscle_group_snapshot,
              weight_mode_snapshot, sort_order
       FROM workout_session_exercises
       WHERE session_id = ?
       ORDER BY sort_order`,
      sessionId
    );
    const exercises: WorkoutSessionExercise[] = await Promise.all(
      exerciseRows.map(async (exercise) => {
        const setRows = await database.getAllAsync<SetRow>(
          `SELECT id, set_number, target_reps, actual_reps, weight_kg,
                  is_completed, completed_at
           FROM workout_sets
           WHERE session_exercise_id = ?
           ORDER BY set_number`,
          exercise.id
        );
        return {
          exerciseId: exercise.exercise_id,
          id: exercise.id,
          muscleGroup: exercise.muscle_group_snapshot,
          name: exercise.exercise_name_snapshot,
          sets: setRows.map(mapSet),
          sortOrder: exercise.sort_order,
          weightMode: exercise.weight_mode_snapshot,
        };
      })
    );

    return {
      cancelledAt: session.cancelled_at,
      completedAt: session.completed_at,
      exercises,
      id: session.id,
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
    return {
      completedAt: session.completedAt,
      completedSetCount: metrics.completedSetCount,
      durationMinutes: calculateWorkoutDurationMinutes(
        session.startedAt,
        session.completedAt
      ),
      exerciseNames: session.exercises.slice(0, 3).map((item) => item.name),
      id: session.id,
      startedAt: session.startedAt,
      totalRepetitions: metrics.totalRepetitions,
      totalVolume: metrics.totalVolume,
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
                  wde.weight_mode
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
               created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            sessionId,
            exercise.exercise_id,
            exercise.name,
            exercise.muscle_group,
            exercise.weight_mode,
            exercise.sort_order,
            timestamp
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
      actualReps: number
    ): Promise<void> {
      if (!canCompleteSet({ actualReps, weightKg })) {
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
               completed_at = ?, updated_at = ?
           WHERE id = ? AND is_completed = 0`,
          weightKg,
          actualReps,
          timestamp,
          timestamp,
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

    async completeSession(sessionId: number): Promise<CompletedWorkoutSummary> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
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
                COALESCE(SUM(CASE WHEN workout_set.is_completed = 1 THEN 1 ELSE 0 END), 0)
                  AS completed_set_count,
                COALESCE(SUM(CASE
                  WHEN workout_set.is_completed = 1
                    AND workout_set.actual_reps IS NOT NULL
                  THEN workout_set.actual_reps ELSE 0 END), 0)
                  AS total_repetitions,
                COALESCE(SUM(CASE
                  WHEN workout_set.is_completed = 1
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
                COALESCE(SUM(CASE WHEN workout_set.is_completed = 1 THEN 1 ELSE 0 END), 0)
                  AS completed_set_count,
                COALESCE(SUM(CASE
                  WHEN workout_set.is_completed = 1
                    AND workout_set.actual_reps IS NOT NULL
                  THEN workout_set.actual_reps ELSE 0 END), 0)
                  AS total_repetitions,
                COALESCE(SUM(CASE
                  WHEN workout_set.is_completed = 1
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
