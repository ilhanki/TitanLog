import type { SQLiteDatabase } from 'expo-sqlite';

import { createExercisePerformanceRepository } from '@/features/workouts/data/exercise-performance-repository';

const headers = [
  {
    completed_at: '2026-07-03T10:00:00.000Z',
    exercise_id: 7,
    exercise_name_snapshot: 'Row',
    session_exercise_id: 31,
    session_id: 3,
    weight_mode_snapshot: 'total',
    workout_name_snapshot: 'Sırt',
  },
  {
    completed_at: '2026-07-02T10:00:00.000Z',
    exercise_id: 8,
    exercise_name_snapshot: 'Curl',
    session_exercise_id: 22,
    session_id: 2,
    weight_mode_snapshot: 'per_hand',
    workout_name_snapshot: 'Kol',
  },
] as const;

const setRows = [
  {
    actual_reps: 10,
    session_exercise_id: 31,
    set_number: 1,
    weight_kg: 60,
  },
  {
    actual_reps: 12,
    session_exercise_id: 22,
    set_number: 1,
    weight_kg: 15,
  },
];

describe('exercise performance repository', () => {
  it('loads several active exercise histories with a bounded batched strategy', async () => {
    const getFirstAsync = jest
      .fn()
      .mockResolvedValue({ started_at: '2026-07-04T10:00:00.000Z' });
    const getAllAsync = jest.fn(async (sql: string) =>
      sql.includes('FROM workout_sets') ? setRows : headers
    );
    const database = {
      getAllAsync,
      getFirstAsync,
    } as unknown as SQLiteDatabase;

    const result = await createExercisePerformanceRepository(
      database
    ).getActiveExercisePerformance(4, [7, 8]);

    expect(result.previous.get(7)?.sessionId).toBe(3);
    expect(result.previous.get(8)?.sessionId).toBe(2);
    expect(result.records.get(7)?.highestWeight?.value).toBe(60);
    expect(getFirstAsync).toHaveBeenCalledTimes(1);
    expect(getAllAsync).toHaveBeenCalledTimes(2);
    expect(getAllAsync.mock.calls[0]?.[0]).toContain("ws.status = 'completed'");
    expect(getAllAsync.mock.calls[0]?.[0]).toContain('ws.id <> ?');
    expect(getAllAsync.mock.calls[0]?.[0]).toContain(
      'ORDER BY wse.exercise_id, ws.completed_at DESC, ws.id DESC'
    );
  });

  it('returns newest-first paginated read-only appearances without duplicates', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({
      equipment: 'Makine',
      id: 7,
      muscle_group: 'Sırt',
      name: 'Row',
    });
    const getAllAsync = jest.fn(async (sql: string) =>
      sql.includes('FROM workout_sets')
        ? setRows.slice(0, 1)
        : headers.slice(0, 1)
    );
    const database = {
      getAllAsync,
      getFirstAsync,
    } as unknown as SQLiteDatabase;

    const result = await createExercisePerformanceRepository(
      database
    ).getExerciseHistory(7, 20, 0);

    expect(result?.exerciseName).toBe('Row');
    expect(result?.recentAppearances.map((item) => item.sessionId)).toEqual([
      3,
    ]);
    expect(result?.recentAppearances[0]?.sets[0]?.setNumber).toBe(1);
    expect(result?.hasMore).toBe(false);
  });
});
