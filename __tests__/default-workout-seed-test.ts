import { defaultWorkoutPlanSeed } from '@/database/seed/default-workout-plan';
import {
  seedDefaultPlan,
  seedDefaultWorkoutPlan,
  type WorkoutSeedStore,
} from '@/database/seed/seed-default-plan';
import type { SQLiteDatabase } from 'expo-sqlite';

function createMemorySeedStore() {
  const plans = new Map<string, number>();
  const days = new Map<string, number>();
  const schedules = new Set<string>();
  const exercises = new Map<string, number>();
  const dayExercises = new Set<string>();
  let nextId = 1;

  const store: WorkoutSeedStore = {
    async upsertPlan(name) {
      const existingId = plans.get(name);
      if (existingId) return existingId;
      const id = nextId++;
      plans.set(name, id);
      return id;
    },
    async upsertDay(planId, day) {
      const key = `${planId}:${day.name}`;
      const existingId = days.get(key);
      if (existingId) return existingId;
      const id = nextId++;
      days.set(key, id);
      return id;
    },
    async addSchedule(workoutDayId, isoWeekday) {
      schedules.add(`${workoutDayId}:${isoWeekday}`);
    },
    async upsertExercise(exercise) {
      const existingId = exercises.get(exercise.name);
      if (existingId) return existingId;
      const id = nextId++;
      exercises.set(exercise.name, id);
      return id;
    },
    async upsertDayExercise(workoutDayId, exerciseId) {
      dayExercises.add(`${workoutDayId}:${exerciseId}`);
    },
  };

  return { dayExercises, days, exercises, plans, schedules, store };
}

describe('default workout plan seed', () => {
  it('contains the expected days, schedules, and exercise defaults', () => {
    expect(defaultWorkoutPlanSeed.name).toBe('Titan Başlangıç Programı');
    expect(
      defaultWorkoutPlanSeed.days.map((day) => day.exercises.length)
    ).toEqual([7, 6, 7]);
    expect(
      defaultWorkoutPlanSeed.days.flatMap((day) => day.scheduleWeekdays)
    ).toEqual([1, 4, 2, 6, 3, 7]);
    expect(
      defaultWorkoutPlanSeed.days.flatMap((day) => day.scheduleWeekdays)
    ).not.toContain(5);
    expect(
      defaultWorkoutPlanSeed.days.every((day) =>
        day.exercises.every(
          (exercise) => exercise.setCount === 3 && exercise.targetReps === 12
        )
      )
    ).toBe(true);
  });

  it('does not duplicate records when applied twice', async () => {
    const memory = createMemorySeedStore();

    await seedDefaultPlan(memory.store, '2026-01-01T00:00:00.000Z');
    await seedDefaultPlan(memory.store, '2026-01-01T00:00:00.000Z');

    expect(memory.plans.size).toBe(1);
    expect(memory.days.size).toBe(3);
    expect(memory.schedules.size).toBe(6);
    expect(memory.exercises.size).toBe(20);
    expect(memory.dayExercises.size).toBe(20);
  });

  it.each([
    'day rename',
    'schedule edit',
    'default edit',
    'exercise reorder',
    'existing exercise addition',
    'custom exercise addition',
    'exercise removal including the final relationship',
  ])('does not reseed or overwrite an active plan after %s', async () => {
    const database = {
      getFirstAsync: jest.fn().mockResolvedValue({ id: 1 }),
      withExclusiveTransactionAsync: jest.fn(),
    } as unknown as SQLiteDatabase;

    await seedDefaultWorkoutPlan(database);

    expect(database.getFirstAsync).toHaveBeenCalledWith(
      'SELECT id FROM workout_plans WHERE is_active = 1 LIMIT 1'
    );
    expect(database.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });
});
