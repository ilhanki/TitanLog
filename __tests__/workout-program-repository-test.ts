import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createWorkoutProgramRepository,
  WorkoutProgramError,
} from '@/features/workouts/data/workout-program-repository';

const defaults = {
  setCount: 3,
  targetReps: 12,
  weightKg: 17.5,
  weightMode: 'per_hand' as const,
};

function createTransaction(overrides: Record<string, unknown> = {}) {
  return {
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue({ id: 1 }),
    runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 50 }),
    ...overrides,
  };
}

function createDatabase(transaction = createTransaction()) {
  return {
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue({ id: 1 }),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    withExclusiveTransactionAsync: jest.fn(async (operation) =>
      operation(transaction)
    ),
  } as unknown as SQLiteDatabase;
}

describe('workout program repository', () => {
  it('updates day metadata and replaces the schedule transactionally', async () => {
    const transaction = createTransaction({
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
    });
    const database = createDatabase(transaction);

    await createWorkoutProgramRepository(database).updateWorkoutDay(1, {
      name: ' Sırt ve Kol ',
      scheduleWeekdays: [1, 5],
      subtitle: ' Çekiş kasları ',
    });

    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE workout_days'),
      'Sırt ve Kol',
      'Çekiş kasları',
      expect.any(String),
      1
    );
    expect(transaction.runAsync).toHaveBeenCalledWith(
      'DELETE FROM workout_day_schedules WHERE workout_day_id = ?',
      1
    );
    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workout_day_schedules'),
      1,
      5
    );
  });

  it('rejects an occupied weekday before replacing any schedule rows', async () => {
    const transaction = createTransaction({
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          iso_weekday: 2,
          workout_day_name: 'Göğüs + Triceps',
        }),
    });
    const database = createDatabase(transaction);

    await expect(
      createWorkoutProgramRepository(database).updateWorkoutDay(1, {
        name: 'Sırt',
        scheduleWeekdays: [2],
        subtitle: '',
      })
    ).rejects.toEqual(
      new WorkoutProgramError('schedule_conflict', {
        dayName: 'Göğüs + Triceps',
        weekday: 2,
      })
    );
    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it('updates exercise defaults without touching session snapshots', async () => {
    const transaction = createTransaction();
    const database = createDatabase(transaction);

    await createWorkoutProgramRepository(database).updateExerciseDefaults(
      1,
      11,
      defaults
    );

    const statements = transaction.runAsync.mock.calls.map(([sql]) => sql);
    expect(statements).toEqual([
      expect.stringContaining('UPDATE workout_day_exercises'),
    ]);
    expect(statements.join(' ')).not.toMatch(
      /workout_sessions|workout_session_exercises|workout_sets|body_/i
    );
  });

  it('reorders exercises and rewrites stable sequential sort orders', async () => {
    const rows = [
      { exercise_id: 11, id: 101, sort_order: 1 },
      { exercise_id: 12, id: 102, sort_order: 2 },
      { exercise_id: 13, id: 103, sort_order: 3 },
    ];
    const transaction = createTransaction({
      getAllAsync: jest.fn().mockResolvedValue(rows),
    });

    await createWorkoutProgramRepository(
      createDatabase(transaction)
    ).reorderExercise(1, 12, 'up');

    expect(
      transaction.runAsync.mock.calls.slice(-3).map((call) => call[1])
    ).toEqual([1, 2, 3]);
    expect(
      transaction.runAsync.mock.calls.slice(-3).map((call) => call[2])
    ).toEqual([102, 101, 103]);
  });

  it('prevents moving the first exercise up', async () => {
    const transaction = createTransaction({
      getAllAsync: jest
        .fn()
        .mockResolvedValue([{ exercise_id: 11, id: 101, sort_order: 1 }]),
    });
    await expect(
      createWorkoutProgramRepository(
        createDatabase(transaction)
      ).reorderExercise(1, 11, 'up')
    ).rejects.toMatchObject({ code: 'reorder_unavailable' });
    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it('removes only the day association and preserves the global exercise', async () => {
    const transaction = createTransaction({
      getAllAsync: jest.fn().mockResolvedValue([]),
    });
    const remaining = await createWorkoutProgramRepository(
      createDatabase(transaction)
    ).removeExerciseFromDay(1, 11);

    expect(remaining).toBe(0);
    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM workout_day_exercises'),
      1,
      11
    );
    expect(transaction.runAsync.mock.calls.join(' ')).not.toContain(
      'DELETE FROM exercises'
    );
  });

  it('links an existing exercise once at the transactional next order', async () => {
    const transaction = createTransaction({
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 22 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ next_order: 5 }),
    });
    await createWorkoutProgramRepository(
      createDatabase(transaction)
    ).addExistingExercise(1, 22, defaults);

    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workout_day_exercises'),
      1,
      22,
      5,
      3,
      12,
      17.5,
      'per_hand'
    );
  });

  it('prevents a duplicate day association', async () => {
    const transaction = createTransaction({
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 22 })
        .mockResolvedValueOnce({ id: 90 }),
    });
    await expect(
      createWorkoutProgramRepository(
        createDatabase(transaction)
      ).addExistingExercise(1, 22, defaults)
    ).rejects.toMatchObject({ code: 'duplicate_exercise' });
    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it('creates a custom exercise and association in one transaction', async () => {
    const transaction = createTransaction({
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ next_order: 4 }),
    });
    const id = await createWorkoutProgramRepository(
      createDatabase(transaction)
    ).createCustomExerciseAndAdd(1, {
      ...defaults,
      equipment: 'Dumbbell',
      muscleGroup: 'Omuz',
      name: 'Custom Raise',
    });

    expect(id).toBe(50);
    expect(transaction.runAsync).toHaveBeenCalledTimes(2);
    expect(transaction.runAsync.mock.calls[0]?.[0]).toContain(
      'INSERT INTO exercises'
    );
    expect(transaction.runAsync.mock.calls[1]?.[0]).toContain(
      'INSERT INTO workout_day_exercises'
    );
  });

  it('propagates association failure so the custom transaction rolls back', async () => {
    const transaction = createTransaction({
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ next_order: 4 }),
      runAsync: jest
        .fn()
        .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 50 })
        .mockRejectedValueOnce(new Error('association failed')),
    });
    await expect(
      createWorkoutProgramRepository(
        createDatabase(transaction)
      ).createCustomExerciseAndAdd(1, {
        ...defaults,
        equipment: '',
        muscleGroup: '',
        name: 'Custom Raise',
      })
    ).rejects.toThrow('association failed');
  });
});
