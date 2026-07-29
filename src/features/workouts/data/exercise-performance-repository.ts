import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  ActiveExercisePerformance,
  ExerciseAppearance,
  ExerciseHistory,
  ExercisePerformanceSet,
  ExerciseRecord,
  ExerciseRecords,
} from '@/features/workouts/domain/exercise-performance';
import type { WeightMode } from '@/features/workouts/domain/models';
import { createExerciseAppearance } from '@/features/workouts/utils/exercise-performance';

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

type RecordSummaryRow = {
  completed_at: string;
  exercise_id: number;
  highest_repetitions: number | null;
  highest_weight: number | null;
  session_id: number;
  session_volume: number | null;
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

function updateSummaryRecord(
  current: ExerciseRecord | null,
  value: number | null,
  row: RecordSummaryRow
): ExerciseRecord | null {
  if (value === null || !Number.isFinite(value) || value < 0) return current;
  if (current && value <= current.value) return current;
  return {
    achievedAt: row.completed_at,
    sessionId: row.session_id,
    value,
  };
}

function summarizeRecords(
  rows: readonly RecordSummaryRow[],
  exerciseId: number,
  lastPerformance: ExerciseAppearance | null
): ExerciseRecords {
  let highestWeight: ExerciseRecord | null = null;
  let highestRepetitions: ExerciseRecord | null = null;
  let highestSessionVolume: ExerciseRecord | null = null;
  const matching = rows
    .filter((row) => row.exercise_id === exerciseId)
    .sort((left, right) => {
      const difference =
        Date.parse(left.completed_at) - Date.parse(right.completed_at);
      return difference || left.session_id - right.session_id;
    });
  for (const row of matching) {
    highestWeight = updateSummaryRecord(highestWeight, row.highest_weight, row);
    highestRepetitions = updateSummaryRecord(
      highestRepetitions,
      row.highest_repetitions,
      row
    );
    highestSessionVolume = updateSummaryRecord(
      highestSessionVolume,
      row.session_volume,
      row
    );
  }
  return {
    appearanceCount: matching.length,
    highestRepetitions,
    highestSessionVolume,
    highestWeight,
    lastPerformance,
    legacyMatched: false,
  };
}

async function loadRecordSummaries(
  database: SQLiteDatabase,
  whereClause: string,
  parameters: readonly (number | string)[]
): Promise<RecordSummaryRow[]> {
  return database.getAllAsync<RecordSummaryRow>(
    `SELECT wse.exercise_id, ws.id AS session_id, ws.completed_at,
            MAX(wset.weight_kg) AS highest_weight,
            MAX(wset.actual_reps) AS highest_repetitions,
            SUM(wset.weight_kg * wset.actual_reps) AS session_volume
     FROM workout_session_exercises AS wse
     JOIN workout_sessions AS ws ON ws.id = wse.session_id
     JOIN workout_sets AS wset ON wset.session_exercise_id = wse.id
     WHERE ws.status = 'completed'
       AND ws.completed_at IS NOT NULL
       AND wset.is_completed = 1
       AND wset.actual_reps IS NOT NULL
       AND ${whereClause}
     GROUP BY wse.id, wse.exercise_id, ws.id, ws.completed_at
     ORDER BY ws.completed_at ASC, ws.id ASC`,
    ...parameters
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
        `WITH ranked AS (
           SELECT wse.id AS session_exercise_id, wse.exercise_id,
                  wse.exercise_name_snapshot, wse.weight_mode_snapshot,
                  ws.id AS session_id, ws.workout_name_snapshot, ws.completed_at,
                  ROW_NUMBER() OVER (
                    PARTITION BY wse.exercise_id
                    ORDER BY ws.completed_at DESC, ws.id DESC
                  ) AS history_rank
           FROM workout_session_exercises AS wse
           JOIN workout_sessions AS ws ON ws.id = wse.session_id
           WHERE ws.status = 'completed'
             AND ws.completed_at IS NOT NULL
             AND ws.id <> ?
             AND ws.completed_at < ?
             AND wse.exercise_id IN (${placeholders(uniqueIds.length)})
         )
         SELECT session_exercise_id, exercise_id, exercise_name_snapshot,
                weight_mode_snapshot, session_id, workout_name_snapshot,
                completed_at
         FROM ranked
         WHERE history_rank = 1
         ORDER BY exercise_id`,
        activeSessionId,
        active.started_at,
        ...uniqueIds
      );
      const setRows = await loadCompletedSets(
        database,
        headers.map((row) => row.session_exercise_id)
      );
      const appearances = mapAppearances(headers, setRows);
      const summaryRows = await loadRecordSummaries(
        database,
        `ws.id <> ? AND ws.completed_at < ?
         AND wse.exercise_id IN (${placeholders(uniqueIds.length)})`,
        [activeSessionId, active.started_at, ...uniqueIds]
      );
      const previous = new Map<number, ExerciseAppearance>();
      const records = new Map<number, ExerciseRecords>();
      for (const exerciseId of uniqueIds) {
        const latest = appearances.find(
          (appearance) => appearance.exerciseId === exerciseId
        );
        if (latest) previous.set(exerciseId, latest);
        records.set(
          exerciseId,
          summarizeRecords(summaryRows, exerciseId, latest ?? null)
        );
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

      const pageHeaders = await database.getAllAsync<AppearanceRow>(
        `SELECT wse.id AS session_exercise_id, wse.exercise_id,
                wse.exercise_name_snapshot, wse.weight_mode_snapshot,
                ws.id AS session_id, ws.workout_name_snapshot, ws.completed_at
         FROM workout_session_exercises AS wse
         JOIN workout_sessions AS ws ON ws.id = wse.session_id
         WHERE wse.exercise_id = ?
           AND ws.status = 'completed'
           AND ws.completed_at IS NOT NULL
         ORDER BY ws.completed_at DESC, ws.id DESC
         LIMIT ? OFFSET ?`,
        exerciseId,
        safeLimit + 1,
        safeOffset
      );
      if (!exercise && pageHeaders.length === 0) return null;

      const hasMore = pageHeaders.length > safeLimit;
      const selectedHeaders = pageHeaders.slice(0, safeLimit);
      const pageSetRows = await loadCompletedSets(
        database,
        selectedHeaders.map((row) => row.session_exercise_id)
      );
      const page = mapAppearances(selectedHeaders, pageSetRows);
      const summaryRows = await loadRecordSummaries(
        database,
        'wse.exercise_id = ?',
        [exerciseId]
      );
      const first = page[0] ?? null;
      return {
        equipment: exercise?.equipment || null,
        exerciseId,
        exerciseName:
          exercise?.name ??
          pageHeaders[0]?.exercise_name_snapshot ??
          'Bilinmeyen egzersiz',
        hasMore,
        legacyMatched: false,
        muscleGroup: exercise?.muscle_group || null,
        recentAppearances: page,
        records: summarizeRecords(summaryRows, exerciseId, first),
        weightMode: first?.weightMode ?? null,
      };
    },
  };
}

export type ExercisePerformanceRepository = ReturnType<
  typeof createExercisePerformanceRepository
>;
