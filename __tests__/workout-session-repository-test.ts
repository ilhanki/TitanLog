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
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, name: 'Sırt + Biceps' }),
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

  it('rejects a valid zero-exercise day without creating a session', async () => {
    const transaction = {
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, name: 'Dinlenme Günü' }),
      runAsync: jest.fn(),
    };
    const database = createDatabase({
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    });

    await expect(
      createWorkoutSessionRepository(database).startSessionFromWorkoutDay(1)
    ).rejects.toMatchObject({ code: 'day_has_no_exercises' });
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
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        completed_at: '2026-07-28T19:12:00.000Z',
        completed_set_count: 19,
        exercise_names: `Lat Pulldown${String.fromCharCode(31)}Cable Curl`,
        id: 10,
        started_at: '2026-07-28T18:00:00.000Z',
        total_repetitions: 228,
        total_volume: 8640,
        workout_day_id: 1,
        workout_name_snapshot: 'Sırt + Biceps',
      },
    ]);
    const database = createDatabase({ getAllAsync });

    const result =
      await createWorkoutSessionRepository(database).getRecentCompletedSessions(
        5
      );

    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = 'completed'"),
      5
    );
    expect(getAllAsync).toHaveBeenCalledTimes(1);
    expect(result[0]).toMatchObject({
      exerciseNames: ['Lat Pulldown', 'Cable Curl'],
      totalVolume: 8640,
      workoutName: 'Sırt + Biceps',
    });
  });

  it('lists completed history newest first with bounded pagination', async () => {
    const getAllAsync = jest.fn().mockResolvedValue([
      {
        completed_at: '2026-07-28T19:12:00.000Z',
        completed_set_count: 19,
        id: 10,
        started_at: '2026-07-28T18:00:00.000Z',
        total_repetitions: 228,
        total_volume: 8640,
        workout_day_id: 1,
        workout_name_snapshot: 'Sırt + Biceps',
      },
    ]);
    const database = createDatabase({ getAllAsync });

    const history = await createWorkoutSessionRepository(
      database
    ).getCompletedWorkoutHistory(100, -2);

    expect(history[0]).toEqual({
      completedAt: '2026-07-28T19:12:00.000Z',
      completedSetCount: 19,
      durationMinutes: 72,
      id: 10,
      startedAt: '2026-07-28T18:00:00.000Z',
      totalRepetitions: 228,
      totalVolume: 8640,
      workoutDayId: 1,
      workoutName: 'Sırt + Biceps',
    });
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE session.status = 'completed'"),
      50,
      0
    );
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'ORDER BY session.completed_at DESC, session.id DESC'
      ),
      50,
      0
    );
  });

  it('loads completed snapshots and the nearest earlier same-day workout', async () => {
    const currentSession = {
      ...activeSessionRow,
      completed_at: '2026-07-28T19:12:00.000Z',
      status: 'completed',
    };
    const previousSession = {
      ...currentSession,
      completed_at: '2026-07-21T19:00:00.000Z',
      id: 9,
      started_at: '2026-07-21T18:00:00.000Z',
    };
    const exerciseRow = {
      exercise_id: 2,
      exercise_name_snapshot: 'Dumbbell Curl',
      id: 20,
      muscle_group_snapshot: 'Biceps',
      sort_order: 1,
      weight_mode_snapshot: 'per_hand',
    };
    const completedSet = {
      actual_reps: 10,
      completed_at: '2026-07-28T18:30:00.000Z',
      id: 30,
      is_completed: 1,
      set_number: 1,
      target_reps: 12,
      weight_kg: 17.5,
    };
    const getFirstAsync = jest
      .fn()
      .mockResolvedValueOnce(currentSession)
      .mockResolvedValueOnce({ id: 9 })
      .mockResolvedValueOnce(previousSession);
    const getAllAsync = jest
      .fn()
      .mockResolvedValueOnce([exerciseRow])
      .mockResolvedValueOnce([completedSet])
      .mockResolvedValueOnce([{ ...exerciseRow, id: 19 }])
      .mockResolvedValueOnce([{ ...completedSet, id: 29 }]);
    const database = createDatabase({ getAllAsync, getFirstAsync });

    const detail =
      await createWorkoutSessionRepository(database).getCompletedWorkoutDetail(
        10
      );

    expect(detail).toMatchObject({
      completedSetCount: 1,
      id: 10,
      totalRepetitions: 10,
      totalVolume: 175,
    });
    expect(detail?.comparison).toMatchObject({ previousSessionId: 9 });
    expect(getFirstAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('workout_day_id = ?'),
      1,
      '2026-07-28T19:12:00.000Z'
    );
    expect(getFirstAsync.mock.calls[1]?.[0]).toContain("status = 'completed'");
  });

  it('snapshots updated future defaults and exercise order without rewriting older sessions', async () => {
    const futureExercises = [
      {
        ...dayExerciseRow,
        default_set_count: 2,
        default_target_reps: 8,
        default_weight_kg: 60,
        exercise_id: 3,
        name: 'Low Row',
        sort_order: 1,
        weight_mode: 'total',
      },
      {
        ...dayExerciseRow,
        default_set_count: 4,
        default_target_reps: 15,
        default_weight_kg: 20,
        sort_order: 2,
      },
    ];
    const transaction = {
      getAllAsync: jest.fn().mockResolvedValue(futureExercises),
      getFirstAsync: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, name: 'Güncel Gün Adı' }),
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

    await createWorkoutSessionRepository(database).startSessionFromWorkoutDay(
      1
    );

    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workout_sessions'),
      1,
      'Güncel Gün Adı',
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workout_session_exercises'),
      10,
      3,
      'Low Row',
      expect.any(String),
      'total',
      1,
      expect.any(String)
    );
    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workout_sets'),
      20,
      1,
      8,
      8,
      60,
      expect.any(String),
      expect.any(String)
    );
    const writtenSql = transaction.runAsync.mock.calls
      .map(([sql]) => sql)
      .join(' ');
    expect(writtenSql).not.toMatch(
      /UPDATE workout_sessions|DELETE FROM workout_/
    );
  });
});
