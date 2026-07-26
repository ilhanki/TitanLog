import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  WorkoutDay,
  WorkoutDayDetails,
  WorkoutExercise,
  WorkoutPlan,
  WeightMode,
} from '@/features/workouts/domain/models';

type PlanRow = {
  description: string;
  id: number;
  name: string;
};

type DayRow = {
  id: number;
  name: string;
  plan_id: number;
  sort_order: number;
  subtitle: string;
};

type ScheduleRow = { iso_weekday: number };
type ExercisePreviewRow = { name: string };

type ExerciseRow = {
  default_set_count: number;
  default_target_reps: number;
  default_weight_kg: number;
  equipment: string;
  id: number;
  muscle_group: string;
  name: string;
  sort_order: number;
  weight_mode: WeightMode;
};

async function getDaySchedules(
  database: SQLiteDatabase,
  workoutDayId: number
): Promise<number[]> {
  const rows = await database.getAllAsync<ScheduleRow>(
    `SELECT iso_weekday
     FROM workout_day_schedules
     WHERE workout_day_id = ?
     ORDER BY iso_weekday`,
    workoutDayId
  );
  return rows.map((row) => row.iso_weekday);
}

async function mapDay(
  database: SQLiteDatabase,
  row: DayRow
): Promise<WorkoutDay> {
  const [scheduleWeekdays, exerciseRows] = await Promise.all([
    getDaySchedules(database, row.id),
    database.getAllAsync<ExercisePreviewRow>(
      `SELECT e.name
       FROM workout_day_exercises AS wde
       JOIN exercises AS e ON e.id = wde.exercise_id
       WHERE wde.workout_day_id = ?
       ORDER BY wde.sort_order`,
      row.id
    ),
  ]);

  return {
    exerciseCount: exerciseRows.length,
    exercisePreview: exerciseRows.slice(0, 3).map((exercise) => exercise.name),
    id: row.id,
    name: row.name,
    scheduleWeekdays,
    sortOrder: row.sort_order,
    subtitle: row.subtitle,
  };
}

export function createWorkoutPlanRepository(database: SQLiteDatabase) {
  async function getWorkoutDays(): Promise<WorkoutDay[]> {
    const rows = await database.getAllAsync<DayRow>(
      `SELECT wd.*
       FROM workout_days AS wd
       JOIN workout_plans AS wp ON wp.id = wd.plan_id
       WHERE wp.is_active = 1
       ORDER BY wd.sort_order`
    );
    return Promise.all(rows.map((row) => mapDay(database, row)));
  }

  async function getWorkoutDayDetails(
    workoutDayId: number
  ): Promise<WorkoutDayDetails | null> {
    const row = await database.getFirstAsync<DayRow>(
      `SELECT wd.*
       FROM workout_days AS wd
       JOIN workout_plans AS wp ON wp.id = wd.plan_id
       WHERE wd.id = ? AND wp.is_active = 1`,
      workoutDayId
    );
    if (!row) return null;

    const [day, exerciseRows] = await Promise.all([
      mapDay(database, row),
      database.getAllAsync<ExerciseRow>(
        `SELECT e.id, e.name, e.muscle_group, e.equipment,
                wde.sort_order, wde.default_set_count,
                wde.default_target_reps, wde.default_weight_kg,
                wde.weight_mode
         FROM workout_day_exercises AS wde
         JOIN exercises AS e ON e.id = wde.exercise_id
         WHERE wde.workout_day_id = ?
         ORDER BY wde.sort_order`,
        workoutDayId
      ),
    ]);
    const exercises: WorkoutExercise[] = exerciseRows.map((exercise) => ({
      equipment: exercise.equipment,
      id: exercise.id,
      muscleGroup: exercise.muscle_group,
      name: exercise.name,
      setCount: exercise.default_set_count,
      sortOrder: exercise.sort_order,
      targetReps: exercise.default_target_reps,
      weightKg: exercise.default_weight_kg,
      weightMode: exercise.weight_mode,
    }));

    return { ...day, exercises };
  }

  return {
    async getActivePlan(): Promise<WorkoutPlan | null> {
      const plan = await database.getFirstAsync<PlanRow>(
        `SELECT id, name, description
         FROM workout_plans
         WHERE is_active = 1`
      );
      if (!plan) return null;

      return {
        days: await getWorkoutDays(),
        description: plan.description,
        id: plan.id,
        name: plan.name,
      };
    },
    async getScheduledWorkout(
      isoWeekday: number
    ): Promise<WorkoutDayDetails | null> {
      const row = await database.getFirstAsync<{ workout_day_id: number }>(
        `SELECT schedules.workout_day_id
         FROM workout_day_schedules AS schedules
         JOIN workout_days AS days ON days.id = schedules.workout_day_id
         JOIN workout_plans AS plans ON plans.id = days.plan_id
         WHERE schedules.iso_weekday = ? AND plans.is_active = 1`,
        isoWeekday
      );
      return row ? getWorkoutDayDetails(row.workout_day_id) : null;
    },
    getWorkoutDayDetails,
    getWorkoutDays,
  };
}

export type WorkoutPlanRepository = ReturnType<
  typeof createWorkoutPlanRepository
>;
