import type { SQLiteDatabase } from 'expo-sqlite';

import {
  defaultWorkoutPlanSeed,
  type DefaultExerciseSeed,
  type DefaultWorkoutDaySeed,
} from '@/database/seed/default-workout-plan';

export type WorkoutSeedStore = {
  addSchedule: (workoutDayId: number, isoWeekday: number) => Promise<void>;
  upsertDay: (
    planId: number,
    day: DefaultWorkoutDaySeed,
    timestamp: string
  ) => Promise<number>;
  upsertDayExercise: (
    workoutDayId: number,
    exerciseId: number,
    exercise: DefaultExerciseSeed,
    sortOrder: number
  ) => Promise<void>;
  upsertExercise: (
    exercise: DefaultExerciseSeed,
    timestamp: string
  ) => Promise<number>;
  upsertPlan: (
    name: string,
    description: string,
    timestamp: string
  ) => Promise<number>;
};

type IdRow = {
  id: number;
};

function requireId(row: IdRow | null, entity: string): number {
  if (!row) {
    throw new Error(`Unable to resolve seeded ${entity}.`);
  }

  return row.id;
}

export async function seedDefaultPlan(
  store: WorkoutSeedStore,
  timestamp: string
): Promise<void> {
  const planId = await store.upsertPlan(
    defaultWorkoutPlanSeed.name,
    defaultWorkoutPlanSeed.description,
    timestamp
  );

  for (const day of defaultWorkoutPlanSeed.days) {
    const workoutDayId = await store.upsertDay(planId, day, timestamp);

    for (const isoWeekday of day.scheduleWeekdays) {
      await store.addSchedule(workoutDayId, isoWeekday);
    }

    for (const [index, exercise] of day.exercises.entries()) {
      const exerciseId = await store.upsertExercise(exercise, timestamp);
      await store.upsertDayExercise(
        workoutDayId,
        exerciseId,
        exercise,
        index + 1
      );
    }
  }
}

function createSQLiteSeedStore(transaction: SQLiteDatabase): WorkoutSeedStore {
  return {
    async upsertPlan(name, description, timestamp) {
      await transaction.runAsync(
        `UPDATE workout_plans
         SET is_active = 0, updated_at = ?
         WHERE is_active = 1 AND name <> ?`,
        timestamp,
        name
      );
      await transaction.runAsync(
        `INSERT INTO workout_plans
          (name, description, is_active, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           description = excluded.description,
           is_active = 1,
           updated_at = excluded.updated_at`,
        name,
        description,
        timestamp,
        timestamp
      );
      const row = await transaction.getFirstAsync<IdRow>(
        'SELECT id FROM workout_plans WHERE name = ?',
        name
      );
      return requireId(row, 'plan');
    },

    async upsertDay(planId, day, timestamp) {
      await transaction.runAsync(
        `INSERT INTO workout_days
          (plan_id, name, subtitle, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(plan_id, name) DO UPDATE SET
           subtitle = excluded.subtitle,
           sort_order = excluded.sort_order,
           updated_at = excluded.updated_at`,
        planId,
        day.name,
        day.subtitle,
        day.sortOrder,
        timestamp,
        timestamp
      );
      const row = await transaction.getFirstAsync<IdRow>(
        'SELECT id FROM workout_days WHERE plan_id = ? AND name = ?',
        planId,
        day.name
      );
      return requireId(row, 'workout day');
    },

    async addSchedule(workoutDayId, isoWeekday) {
      await transaction.runAsync(
        `INSERT INTO workout_day_schedules (workout_day_id, iso_weekday)
         VALUES (?, ?)
         ON CONFLICT(workout_day_id, iso_weekday) DO NOTHING`,
        workoutDayId,
        isoWeekday
      );
    },

    async upsertExercise(exercise, timestamp) {
      await transaction.runAsync(
        `INSERT INTO exercises
          (name, muscle_group, equipment, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           muscle_group = excluded.muscle_group,
           equipment = excluded.equipment,
           updated_at = excluded.updated_at`,
        exercise.name,
        exercise.muscleGroup,
        exercise.equipment,
        timestamp,
        timestamp
      );
      const row = await transaction.getFirstAsync<IdRow>(
        'SELECT id FROM exercises WHERE name = ?',
        exercise.name
      );
      return requireId(row, 'exercise');
    },

    async upsertDayExercise(workoutDayId, exerciseId, exercise, sortOrder) {
      await transaction.runAsync(
        `INSERT INTO workout_day_exercises
          (workout_day_id, exercise_id, sort_order, default_set_count,
           default_target_reps, default_weight_kg, weight_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workout_day_id, exercise_id) DO UPDATE SET
           sort_order = excluded.sort_order,
           default_set_count = excluded.default_set_count,
           default_target_reps = excluded.default_target_reps,
           default_weight_kg = excluded.default_weight_kg,
           weight_mode = excluded.weight_mode`,
        workoutDayId,
        exerciseId,
        sortOrder,
        exercise.setCount,
        exercise.targetReps,
        exercise.weightKg,
        exercise.weightMode
      );
    },
  };
}

export async function seedDefaultWorkoutPlan(
  database: SQLiteDatabase
): Promise<void> {
  const existingActivePlan = await database.getFirstAsync<IdRow>(
    'SELECT id FROM workout_plans WHERE is_active = 1 LIMIT 1'
  );
  if (existingActivePlan) return;

  const timestamp = new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await seedDefaultPlan(createSQLiteSeedStore(transaction), timestamp);
  });
}
