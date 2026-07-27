import type { SQLiteDatabase } from 'expo-sqlite';

import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';

const activeSessionRow = {
  cancelled_at: null,
  completed_at: null,
  id: 10,
  started_at: '2026-07-31T10:00:00.000Z',
  status: 'active',
  workout_day_id: 1,
  workout_name_snapshot: 'Sırt + Biceps',
};

const dayExerciseRow = {
  default_set_count: 3,
  default_target_reps: 12,
  default_weight_kg: 17.5,
  exercise_id: 2,
  muscle_group: 'Biceps',
  name: 'Dumbbell Curl',
  sort_order: 1,
  weight_mode: 'per_hand',
  workout_day_name: 'Sırt + Biceps',
};

function createDatabase(overrides: Record<string, unknown> = {}) {
  return {
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(activeSessionRow),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    withExclusiveTransactionAsync: jest.fn(),
    ...overrides,
  } as unknown as SQLiteDatabase;
}

describe('workout session repository', () => {
  it('transactionally creates exercise snapshots and default set rows', async () => {
    const transaction = {
      getAllAsync: jest.fn().mockResolvedValue([dayExerciseRow]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      runAsync: jest
        .fn()
        .mockResolvedValueOnce({ lastInsertRowId: 10 })
        .mockResolvedValueOnce({ lastInsertRowId: 20 })
        .mockResolvedValue({ lastInsertRowId: 30 }),
    };
    const database = createDatabase({
      getAllAsync: jest.fn().mockResolvedValue([]),
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    });

    const session =
      await createWorkoutSessionRepository(database).startSessionFromWorkoutDay(
        1
      );

    expect(session.id).toBe(10);
    expect(transaction.runAsync).toHaveBeenCalledTimes(5);
    expect(transaction.runAsync.mock.calls[2]?.slice(1, 6)).toEqual([
      20, 1, 12, 12, 17.5,
    ]);
  });

  it('returns the existing active session without writing a second one', async () => {
    const transaction = {
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn().mockResolvedValue({ id: 10 }),
      runAsync: jest.fn(),
    };
    const database = createDatabase({
      getAllAsync: jest.fn().mockResolvedValue([]),
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    });

    const session =
      await createWorkoutSessionRepository(database).startSessionFromWorkoutDay(
        2
      );

    expect(session.id).toBe(10);
    expect(transaction.getAllAsync).not.toHaveBeenCalled();
    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it('completes one set and prefills the next set atomically', async () => {
    const transaction = {
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce({
          actual_reps: 12,
          completed_at: null,
          id: 30,
          is_completed: 0,
          session_exercise_id: 20,
          set_number: 1,
          target_reps: 12,
          weight_kg: 50,
        })
        .mockResolvedValueOnce({ id: 31 }),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };
    const database = createDatabase({
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    });

    await createWorkoutSessionRepository(database).completeSetAndPrefillNext(
      30,
      52.5,
      10
    );

    expect(transaction.runAsync).toHaveBeenCalledTimes(2);
    expect(transaction.runAsync).toHaveBeenLastCalledWith(
      expect.stringContaining('SET weight_kg = ?, actual_reps = ?'),
      52.5,
      10,
      expect.any(String),
      31
    );
  });

  it('rejects a repeated completion without advancing another set', async () => {
    const transaction = {
      getFirstAsync: jest.fn().mockResolvedValue({
        actual_reps: 12,
        completed_at: '2026-07-31T10:30:00.000Z',
        id: 30,
        is_completed: 1,
        session_exercise_id: 20,
        set_number: 1,
        target_reps: 12,
        weight_kg: 50,
      }),
      runAsync: jest.fn(),
    };
    const database = createDatabase({
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    });

    await expect(
      createWorkoutSessionRepository(database).completeSetAndPrefillNext(
        30,
        50,
        12
      )
    ).rejects.toMatchObject({ code: 'set_already_completed' });
    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it('edits set values without changing completed status', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
    const database = createDatabase({ runAsync });

    await createWorkoutSessionRepository(database).updateSetValues(
      30,
      52.5,
      10
    );

    expect(runAsync).toHaveBeenCalledWith(
      expect.not.stringMatching(/is_completed|completed_at/),
      52.5,
      10,
      expect.any(String),
      30
    );
  });

  it('copies the final set values when adding one set', async () => {
    const transaction = {
      getFirstAsync: jest.fn().mockResolvedValue({
        actual_reps: 10,
        completed_at: null,
        id: 32,
        is_completed: 0,
        set_number: 3,
        target_reps: 12,
        weight_kg: 52.5,
      }),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };
    const database = createDatabase({
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    });

    await createWorkoutSessionRepository(database).addSet(20);

    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workout_sets'),
      20,
      4,
      12,
      10,
      52.5,
      expect.any(String),
      expect.any(String)
    );
  });

  it('removes only the final incomplete set', async () => {
    const transaction = {
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 30, is_completed: 1, set_number: 1 },
        { id: 31, is_completed: 0, set_number: 2 },
      ]),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };
    const database = createDatabase({
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    });

    await createWorkoutSessionRepository(database).removeLastIncompleteSet(20);

    expect(transaction.runAsync).toHaveBeenCalledWith(
      'DELETE FROM workout_sets WHERE id = ?',
      31
    );
  });

  it('rejects removing the final set when it is completed', async () => {
    const transaction = {
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 30, is_completed: 0, set_number: 1 },
        { id: 31, is_completed: 1, set_number: 2 },
      ]),
      runAsync: jest.fn(),
    };
    const database = createDatabase({
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    });

    await expect(
      createWorkoutSessionRepository(database).removeLastIncompleteSet(20)
    ).rejects.toMatchObject({ code: 'set_not_removable' });
    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it('completes a session only after a completed set and returns real metrics', async () => {
    const transaction = {
      getFirstAsync: jest.fn().mockResolvedValue({ count: 1 }),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };
    const database = createDatabase({
      getAllAsync: jest.fn(async (sql: string) =>
        sql.includes('FROM workout_session_exercises')
          ? [
              {
                exercise_id: 2,
                exercise_name_snapshot: 'Dumbbell Curl',
                id: 20,
                muscle_group_snapshot: 'Biceps',
                sort_order: 1,
                weight_mode_snapshot: 'per_hand',
              },
            ]
          : [
              {
                actual_reps: 10,
                completed_at: '2026-07-31T11:00:00.000Z',
                id: 30,
                is_completed: 1,
                set_number: 1,
                target_reps: 10,
                weight_kg: 17.5,
              },
            ]
      ),
      getFirstAsync: jest.fn().mockResolvedValue({
        ...activeSessionRow,
        completed_at: '2026-07-31T11:00:00.000Z',
        status: 'completed',
      }),
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    });

    const summary =
      await createWorkoutSessionRepository(database).completeSession(10);

    expect(summary).toMatchObject({
      completedSetCount: 1,
      totalRepetitions: 10,
      totalVolume: 175,
    });
    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'completed'"),
      expect.any(String),
      expect.any(String),
      10
    );
  });

  it('keeps cancelled sessions out of the completed count', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ count: 0 });
    const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
    const database = createDatabase({ getFirstAsync, runAsync });
    const repository = createWorkoutSessionRepository(database);

    await repository.cancelSession(10);
    const completedCount = await repository.getCompletedSessionCount();

    expect(completedCount).toBe(0);
    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'cancelled'"),
      expect.any(String),
      expect.any(String),
      10
    );
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'completed'")
    );
  });

  it('queries recent history from completed sessions only', async () => {
    const getAllAsync = jest.fn().mockResolvedValue([]);
    const database = createDatabase({ getAllAsync });

    await createWorkoutSessionRepository(database).getRecentCompletedSessions(
      5
    );

    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = 'completed'"),
      5
    );
  });
});
