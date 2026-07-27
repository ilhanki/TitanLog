import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  CompletedWorkoutSummary,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionStatus,
  WorkoutSet,
  WeightMode,
} from '@/features/workouts/domain/models';
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

type DayExerciseRow = {
  default_set_count: number;
  default_target_reps: number;
  default_weight_kg: number;
  exercise_id: number;
  muscle_group: string;
  name: string;
  sort_order: number;
  weight_mode: WeightMode;
  workout_day_name: string;
};

export type WorkoutSessionErrorCode =
  | 'day_not_found'
  | 'invalid_set'
  | 'no_completed_sets'
  | 'session_not_active'
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
      exerciseNames: session.exercises.slice(0, 3).map((item) => item.name),
      id: session.id,
      totalRepetitions: metrics.totalRepetitions,
      totalVolume: metrics.totalVolume,
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

        const exercises = await transaction.getAllAsync<DayExerciseRow>(
          `SELECT wd.name AS workout_day_name, e.id AS exercise_id, e.name,
                  e.muscle_group, wde.sort_order, wde.default_set_count,
                  wde.default_target_reps, wde.default_weight_kg,
                  wde.weight_mode
           FROM workout_days AS wd
           JOIN workout_day_exercises AS wde ON wde.workout_day_id = wd.id
           JOIN exercises AS e ON e.id = wde.exercise_id
           WHERE wd.id = ?
           ORDER BY wde.sort_order`,
          workoutDayId
        );
        if (exercises.length === 0) {
          throw new WorkoutSessionError('day_not_found');
        }

        const timestamp = new Date().toISOString();
        const result = await transaction.runAsync(
          `INSERT INTO workout_sessions
            (workout_day_id, workout_name_snapshot, status, started_at,
             created_at, updated_at)
           VALUES (?, ?, 'active', ?, ?, ?)`,
          workoutDayId,
          exercises[0]!.workout_day_name,
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
      await database.runAsync(
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

    async getRecentCompletedSessions(
      limit = 5
    ): Promise<CompletedWorkoutSummary[]> {
      const rows = await database.getAllAsync<{ id: number }>(
        `SELECT id FROM workout_sessions
         WHERE status = 'completed'
         ORDER BY completed_at DESC
         LIMIT ?`,
        limit
      );
      const summaries = await Promise.all(
        rows.map((row) => getCompletedSummary(row.id))
      );
      return summaries.filter(
        (summary): summary is CompletedWorkoutSummary => summary !== null
      );
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
