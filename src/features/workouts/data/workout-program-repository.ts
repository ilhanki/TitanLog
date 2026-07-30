import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  AvailableExercise,
  CustomExerciseDraft,
  ExerciseDefaultsDraft,
  WorkoutDayDraft,
} from '@/features/workouts/domain/models';
import {
  MAX_EXERCISE_NAME_LENGTH,
  MAX_WORKOUT_DAY_NAME_LENGTH,
  isDuplicateExerciseName,
  normalizeOptionalText,
  normalizeRequiredName,
  normalizeWeekdays,
} from '@/features/workouts/utils/workout-program-validation';

export type WorkoutProgramErrorCode =
  | 'day_not_found'
  | 'duplicate_day_name'
  | 'duplicate_exercise'
  | 'exercise_not_found'
  | 'invalid_defaults'
  | 'invalid_day'
  | 'invalid_exercise'
  | 'invalid_schedule'
  | 'reorder_unavailable'
  | 'schedule_conflict';

export class WorkoutProgramError extends Error {
  constructor(
    readonly code: WorkoutProgramErrorCode,
    readonly details?: { dayName?: string; weekday?: number }
  ) {
    super(code);
  }
}

type IdRow = { id: number };
type OrderRow = { exercise_id: number; id: number; sort_order: number };
type ConflictRow = { iso_weekday: number; workout_day_name: string };
type ExerciseRow = {
  equipment: string;
  id: number;
  muscle_group: string;
  name: string;
};

function validateDefaults(defaults: ExerciseDefaultsDraft): void {
  if (
    !Number.isSafeInteger(defaults.setCount) ||
    defaults.setCount < 1 ||
    defaults.setCount > 10 ||
    !Number.isSafeInteger(defaults.targetReps) ||
    defaults.targetReps < 1 ||
    defaults.targetReps > 100 ||
    !Number.isFinite(defaults.weightKg) ||
    defaults.weightKg <= 0 ||
    defaults.weightKg > 2000 ||
    !['total', 'per_hand'].includes(defaults.weightMode)
  ) {
    throw new WorkoutProgramError('invalid_defaults');
  }
}

async function requireActiveDay(
  database: SQLiteDatabase,
  workoutDayId: number
): Promise<IdRow> {
  const row = await database.getFirstAsync<IdRow>(
    `SELECT wd.id
     FROM workout_days AS wd
     JOIN workout_plans AS wp ON wp.id = wd.plan_id
     WHERE wd.id = ? AND wp.is_active = 1`,
    workoutDayId
  );
  if (!row) throw new WorkoutProgramError('day_not_found');
  return row;
}

async function normalizeSortOrders(
  database: SQLiteDatabase,
  orderedRows: readonly OrderRow[]
): Promise<void> {
  for (const [index, row] of orderedRows.entries()) {
    await database.runAsync(
      'UPDATE workout_day_exercises SET sort_order = ? WHERE id = ?',
      -(index + 1),
      row.id
    );
  }
  for (const [index, row] of orderedRows.entries()) {
    await database.runAsync(
      'UPDATE workout_day_exercises SET sort_order = ? WHERE id = ?',
      index + 1,
      row.id
    );
  }
}

export function createWorkoutProgramRepository(database: SQLiteDatabase) {
  return {
    async updateWorkoutDay(
      workoutDayId: number,
      draft: WorkoutDayDraft
    ): Promise<void> {
      const name = normalizeRequiredName(
        draft.name,
        MAX_WORKOUT_DAY_NAME_LENGTH
      );
      const subtitle = normalizeOptionalText(draft.subtitle);
      const weekdays = normalizeWeekdays(draft.scheduleWeekdays);
      if (!name || subtitle === null) {
        throw new WorkoutProgramError('invalid_day');
      }
      if (weekdays.length === 0) {
        throw new WorkoutProgramError('invalid_schedule');
      }

      await database.withExclusiveTransactionAsync(async (transaction) => {
        const day = await requireActiveDay(transaction, workoutDayId);
        const duplicate = await transaction.getFirstAsync<IdRow>(
          `SELECT other.id
           FROM workout_days AS other
           JOIN workout_days AS current ON current.plan_id = other.plan_id
           WHERE current.id = ? AND other.id <> current.id
             AND lower(trim(other.name)) = lower(trim(?))`,
          day.id,
          name
        );
        if (duplicate) {
          throw new WorkoutProgramError('duplicate_day_name');
        }

        for (const weekday of weekdays) {
          const conflict = await transaction.getFirstAsync<ConflictRow>(
            `SELECT schedules.iso_weekday, days.name AS workout_day_name
             FROM workout_day_schedules AS schedules
             JOIN workout_days AS days ON days.id = schedules.workout_day_id
             JOIN workout_plans AS plans ON plans.id = days.plan_id
             WHERE schedules.iso_weekday = ? AND schedules.workout_day_id <> ?
               AND plans.is_active = 1`,
            weekday,
            day.id
          );
          if (conflict) {
            throw new WorkoutProgramError('schedule_conflict', {
              dayName: conflict.workout_day_name,
              weekday: conflict.iso_weekday,
            });
          }
        }

        const timestamp = new Date().toISOString();
        await transaction.runAsync(
          `UPDATE workout_days
           SET name = ?, subtitle = ?, updated_at = ?
           WHERE id = ?`,
          name,
          subtitle,
          timestamp,
          day.id
        );
        await transaction.runAsync(
          'DELETE FROM workout_day_schedules WHERE workout_day_id = ?',
          day.id
        );
        for (const weekday of weekdays) {
          await transaction.runAsync(
            `INSERT INTO workout_day_schedules (workout_day_id, iso_weekday)
             VALUES (?, ?)`,
            day.id,
            weekday
          );
        }
      });
    },

    async updateExerciseDefaults(
      workoutDayId: number,
      exerciseId: number,
      defaults: ExerciseDefaultsDraft
    ): Promise<void> {
      validateDefaults(defaults);
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await requireActiveDay(transaction, workoutDayId);
        const result = await transaction.runAsync(
          `UPDATE workout_day_exercises
           SET default_set_count = ?, default_target_reps = ?,
               default_weight_kg = ?, weight_mode = ?
           WHERE workout_day_id = ? AND exercise_id = ?`,
          defaults.setCount,
          defaults.targetReps,
          defaults.weightKg,
          defaults.weightMode,
          workoutDayId,
          exerciseId
        );
        if (result.changes !== 1) {
          throw new WorkoutProgramError('exercise_not_found');
        }
      });
    },

    async reorderExercise(
      workoutDayId: number,
      exerciseId: number,
      direction: 'up' | 'down'
    ): Promise<void> {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await requireActiveDay(transaction, workoutDayId);
        const rows = await transaction.getAllAsync<OrderRow>(
          `SELECT id, exercise_id, sort_order
           FROM workout_day_exercises
           WHERE workout_day_id = ?
           ORDER BY sort_order, id`,
          workoutDayId
        );
        const currentIndex = rows.findIndex(
          (row) => row.exercise_id === exerciseId
        );
        const targetIndex =
          direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= rows.length) {
          throw new WorkoutProgramError('reorder_unavailable');
        }
        const ordered = [...rows];
        [ordered[currentIndex], ordered[targetIndex]] = [
          ordered[targetIndex]!,
          ordered[currentIndex]!,
        ];
        await normalizeSortOrders(transaction, ordered);
      });
    },

    async reorderExerciseToIndex(
      workoutDayId: number,
      exerciseId: number,
      targetIndex: number
    ): Promise<boolean> {
      let changed = false;
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await requireActiveDay(transaction, workoutDayId);
        const rows = await transaction.getAllAsync<OrderRow>(
          `SELECT id, exercise_id, sort_order
           FROM workout_day_exercises
           WHERE workout_day_id = ?
           ORDER BY sort_order, id`,
          workoutDayId
        );
        const currentIndex = rows.findIndex(
          (row) => row.exercise_id === exerciseId
        );
        if (
          currentIndex < 0 ||
          !Number.isSafeInteger(targetIndex) ||
          targetIndex < 0 ||
          targetIndex >= rows.length
        ) {
          throw new WorkoutProgramError('reorder_unavailable');
        }
        if (currentIndex === targetIndex) return;
        const ordered = [...rows];
        const [moved] = ordered.splice(currentIndex, 1);
        ordered.splice(targetIndex, 0, moved!);
        await normalizeSortOrders(transaction, ordered);
        changed = true;
      });
      return changed;
    },

    async removeExerciseFromDay(
      workoutDayId: number,
      exerciseId: number
    ): Promise<number> {
      let remainingCount = 0;
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await requireActiveDay(transaction, workoutDayId);
        const result = await transaction.runAsync(
          `DELETE FROM workout_day_exercises
           WHERE workout_day_id = ? AND exercise_id = ?`,
          workoutDayId,
          exerciseId
        );
        if (result.changes !== 1) {
          throw new WorkoutProgramError('exercise_not_found');
        }
        const rows = await transaction.getAllAsync<OrderRow>(
          `SELECT id, exercise_id, sort_order
           FROM workout_day_exercises
           WHERE workout_day_id = ?
           ORDER BY sort_order, id`,
          workoutDayId
        );
        await normalizeSortOrders(transaction, rows);
        remainingCount = rows.length;
      });
      return remainingCount;
    },

    async getAvailableExercises(
      workoutDayId: number,
      search = ''
    ): Promise<AvailableExercise[]> {
      await requireActiveDay(database, workoutDayId);
      const normalizedSearch = `%${search.trim().toLocaleLowerCase('tr-TR')}%`;
      const rows = await database.getAllAsync<ExerciseRow>(
        `SELECT e.id, e.name, e.muscle_group, e.equipment
         FROM exercises AS e
         WHERE NOT EXISTS (
           SELECT 1 FROM workout_day_exercises AS linked
           WHERE linked.workout_day_id = ? AND linked.exercise_id = e.id
         ) AND lower(e.name) LIKE ?
         ORDER BY e.name COLLATE NOCASE, e.id`,
        workoutDayId,
        normalizedSearch
      );
      return rows.map((row) => ({
        equipment: row.equipment,
        id: row.id,
        muscleGroup: row.muscle_group,
        name: row.name,
      }));
    },

    async addExistingExercise(
      workoutDayId: number,
      exerciseId: number,
      defaults: ExerciseDefaultsDraft
    ): Promise<void> {
      validateDefaults(defaults);
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await requireActiveDay(transaction, workoutDayId);
        const exercise = await transaction.getFirstAsync<IdRow>(
          'SELECT id FROM exercises WHERE id = ?',
          exerciseId
        );
        if (!exercise) throw new WorkoutProgramError('exercise_not_found');
        const linked = await transaction.getFirstAsync<IdRow>(
          `SELECT id FROM workout_day_exercises
           WHERE workout_day_id = ? AND exercise_id = ?`,
          workoutDayId,
          exerciseId
        );
        if (linked) throw new WorkoutProgramError('duplicate_exercise');
        const order = await transaction.getFirstAsync<{ next_order: number }>(
          `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
           FROM workout_day_exercises WHERE workout_day_id = ?`,
          workoutDayId
        );
        await transaction.runAsync(
          `INSERT INTO workout_day_exercises
            (workout_day_id, exercise_id, sort_order, default_set_count,
             default_target_reps, default_weight_kg, weight_mode)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          workoutDayId,
          exerciseId,
          order?.next_order ?? 1,
          defaults.setCount,
          defaults.targetReps,
          defaults.weightKg,
          defaults.weightMode
        );
      });
    },

    async createCustomExerciseAndAdd(
      workoutDayId: number,
      draft: CustomExerciseDraft
    ): Promise<number> {
      const name = normalizeRequiredName(draft.name, MAX_EXERCISE_NAME_LENGTH);
      const muscleGroup = normalizeOptionalText(draft.muscleGroup);
      const equipment = normalizeOptionalText(draft.equipment);
      validateDefaults(draft);
      if (!name || muscleGroup === null || equipment === null) {
        throw new WorkoutProgramError('invalid_exercise');
      }

      let exerciseId = 0;
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await requireActiveDay(transaction, workoutDayId);
        const existingNames = await transaction.getAllAsync<{ name: string }>(
          'SELECT name FROM exercises'
        );
        if (
          isDuplicateExerciseName(
            name,
            existingNames.map((exercise) => exercise.name)
          )
        ) {
          throw new WorkoutProgramError('duplicate_exercise');
        }
        const timestamp = new Date().toISOString();
        const result = await transaction.runAsync(
          `INSERT INTO exercises
            (name, muscle_group, equipment, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          name,
          muscleGroup,
          equipment,
          timestamp,
          timestamp
        );
        exerciseId = result.lastInsertRowId;
        const order = await transaction.getFirstAsync<{ next_order: number }>(
          `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
           FROM workout_day_exercises WHERE workout_day_id = ?`,
          workoutDayId
        );
        await transaction.runAsync(
          `INSERT INTO workout_day_exercises
            (workout_day_id, exercise_id, sort_order, default_set_count,
             default_target_reps, default_weight_kg, weight_mode)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          workoutDayId,
          exerciseId,
          order?.next_order ?? 1,
          draft.setCount,
          draft.targetReps,
          draft.weightKg,
          draft.weightMode
        );
      });
      return exerciseId;
    },
  };
}

export type WorkoutProgramRepository = ReturnType<
  typeof createWorkoutProgramRepository
>;
