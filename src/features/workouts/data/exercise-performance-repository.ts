import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  ActiveExercisePerformance,
  ExerciseAppearance,
  ExerciseHistory,
  ExercisePerformanceSet,
  ExerciseRecords,
} from '@/features/workouts/domain/exercise-performance';
import type { WeightMode } from '@/features/workouts/domain/models';
import {
  calculateExerciseRecords,
  createExerciseAppearance,
} from '@/features/workouts/utils/exercise-performance';

type AppearanceRow = {
  completed_at: string;
  exercise_id: number;
  exercise_name_snapshot: string;
  session_exercise_id: number;
  session_id: number;
  weight_mode_snapshot: WeightMode;
  workout_name_snapshot: string;
};

type PerformanceSetRow = {
  actual_reps: number;
  session_exercise_id: number;
  set_number: number;
  weight_kg: number;
};

type ExerciseRow = {
  equipment: string;
  id: number;
  muscle_group: string;
  name: string;
};

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function mapAppearances(
  rows: readonly AppearanceRow[],
  setRows: readonly PerformanceSetRow[]
): ExerciseAppearance[] {
  const setsByAppearance = new Map<number, ExercisePerformanceSet[]>();
  for (const row of setRows) {
    const sets = setsByAppearance.get(row.session_exercise_id) ?? [];
    sets.push({
      actualReps: row.actual_reps,
      setNumber: row.set_number,
      weightKg: row.weight_kg,
    });
    setsByAppearance.set(row.session_exercise_id, sets);
  }
  return rows.map((row) =>
    createExerciseAppearance({
      completedAt: row.completed_at,
      exerciseId: row.exercise_id,
      legacyMatched: false,
      sessionExerciseId: row.session_exercise_id,
      sessionId: row.session_id,
      sets: setsByAppearance.get(row.session_exercise_id) ?? [],
      weightMode: row.weight_mode_snapshot,
      workoutName: row.workout_name_snapshot,
    })
  );
}

async function loadCompletedSets(
  database: SQLiteDatabase,
  appearanceIds: readonly number[]
): Promise<PerformanceSetRow[]> {
  if (appearanceIds.length === 0) return [];
  return database.getAllAsync<PerformanceSetRow>(
    `SELECT session_exercise_id, set_number, actual_reps, weight_kg
     FROM workout_sets
     WHERE is_completed = 1
       AND actual_reps IS NOT NULL
       AND session_exercise_id IN (${placeholders(appearanceIds.length)})
     ORDER BY session_exercise_id, set_number`,
    ...appearanceIds
  );
}

export function createExercisePerformanceRepository(database: SQLiteDatabase) {
  return {
    async getActiveExercisePerformance(
      activeSessionId: number,
      exerciseIds: readonly number[]
    ): Promise<ActiveExercisePerformance> {
      const uniqueIds = [...new Set(exerciseIds)].filter((id) => id > 0);
      if (uniqueIds.length === 0) {
        return { previous: new Map(), records: new Map() };
      }
      const active = await database.getFirstAsync<{ started_at: string }>(
        `SELECT started_at FROM workout_sessions
         WHERE id = ? AND status = 'active'`,
        activeSessionId
      );
      if (!active) return { previous: new Map(), records: new Map() };

      const headers = await database.getAllAsync<AppearanceRow>(
        `SELECT wse.id AS session_exercise_id, wse.exercise_id,
                wse.exercise_name_snapshot, wse.weight_mode_snapshot,
                ws.id AS session_id, ws.workout_name_snapshot, ws.completed_at
         FROM workout_session_exercises AS wse
         JOIN workout_sessions AS ws ON ws.id = wse.session_id
         WHERE ws.status = 'completed'
           AND ws.completed_at IS NOT NULL
           AND ws.id <> ?
           AND ws.completed_at < ?
           AND wse.exercise_id IN (${placeholders(uniqueIds.length)})
         ORDER BY wse.exercise_id, ws.completed_at DESC, ws.id DESC`,
        activeSessionId,
        active.started_at,
        ...uniqueIds
      );
      const setRows = await loadCompletedSets(
        database,
        headers.map((row) => row.session_exercise_id)
      );
      const appearances = mapAppearances(headers, setRows);
      const previous = new Map<number, ExerciseAppearance>();
      const records = new Map<number, ExerciseRecords>();
      for (const exerciseId of uniqueIds) {
        const matches = appearances.filter(
          (appearance) => appearance.exerciseId === exerciseId
        );
        if (matches[0]) previous.set(exerciseId, matches[0]);
        records.set(exerciseId, calculateExerciseRecords(matches));
      }
      return { previous, records };
    },

    async getExerciseHistory(
      exerciseId: number,
      limit = 20,
      offset = 0
    ): Promise<ExerciseHistory | null> {
      const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
      const safeOffset = Math.max(0, Math.floor(offset));
      const exercise = await database.getFirstAsync<ExerciseRow>(
        `SELECT id, name, muscle_group, equipment
         FROM exercises WHERE id = ?`,
        exerciseId
      );

      const allHeaders = await database.getAllAsync<AppearanceRow>(
        `SELECT wse.id AS session_exercise_id, wse.exercise_id,
                wse.exercise_name_snapshot, wse.weight_mode_snapshot,
                ws.id AS session_id, ws.workout_name_snapshot, ws.completed_at
         FROM workout_session_exercises AS wse
         JOIN workout_sessions AS ws ON ws.id = wse.session_id
         WHERE wse.exercise_id = ?
           AND ws.status = 'completed'
           AND ws.completed_at IS NOT NULL
         ORDER BY ws.completed_at DESC, ws.id DESC`,
        exerciseId
      );
      if (!exercise && allHeaders.length === 0) return null;

      const allSetRows = await loadCompletedSets(
        database,
        allHeaders.map((row) => row.session_exercise_id)
      );
      const allAppearances = mapAppearances(allHeaders, allSetRows);
      const page = allAppearances.slice(safeOffset, safeOffset + safeLimit);
      const first = allAppearances[0] ?? null;
      return {
        equipment: exercise?.equipment || null,
        exerciseId,
        exerciseName:
          exercise?.name ??
          allHeaders[0]?.exercise_name_snapshot ??
          'Bilinmeyen egzersiz',
        hasMore: safeOffset + page.length < allAppearances.length,
        legacyMatched: false,
        muscleGroup: exercise?.muscle_group || null,
        recentAppearances: page,
        records: calculateExerciseRecords(allAppearances),
        weightMode: first?.weightMode ?? null,
      };
    },
  };
}

export type ExercisePerformanceRepository = ReturnType<
  typeof createExercisePerformanceRepository
>;
