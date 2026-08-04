import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { migration001 } from '@/database/migrations/migration-001';
import { migration002 } from '@/database/migrations/migration-002';
import { createInsightsRepository } from '@/features/insights/insights-repository';

function adapter(database: DatabaseSync): SQLiteDatabase {
  return {
    getAllAsync: async <T>(sql: string, ...params: SQLInputValue[]) =>
      database.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T>(sql: string, ...params: SQLInputValue[]) =>
      (database.prepare(sql).get(...params) as T | undefined) ?? null,
  } as unknown as SQLiteDatabase;
}

describe('fitness insights repository', () => {
  it('aggregates only completed canonical rows without doubling per-hand load', async () => {
    const database = new DatabaseSync(':memory:');
    database.exec(migration001.sql);
    database.exec(migration002.sql);
    database.exec(`
      INSERT INTO workout_plans VALUES (1, 'Plan', '', 1, '2026-08-01', '2026-08-01');
      INSERT INTO workout_days VALUES (1, 1, 'Gün', '', 1, '2026-08-01', '2026-08-01');
      INSERT INTO exercises VALUES (1, 'Dumbbell Press', 'Göğüs', 'Dumbbell', '2026-08-01', '2026-08-01');
      INSERT INTO workout_sessions VALUES (1, 1, 'Gün', 'completed', '2026-08-03T10:00:00.000Z', '2026-08-03T11:00:00.000Z', NULL, '2026-08-03', '2026-08-03');
      INSERT INTO workout_sessions VALUES (2, 1, 'Gün', 'cancelled', '2026-08-04T10:00:00.000Z', NULL, '2026-08-04T10:05:00.000Z', '2026-08-04', '2026-08-04');
      INSERT INTO workout_session_exercises VALUES (1, 1, 1, 'Dumbbell Press', 'Göğüs', 'per_hand', 1, '2026-08-03');
      INSERT INTO workout_session_exercises VALUES (2, 2, 1, 'Dumbbell Press', 'Göğüs', 'per_hand', 1, '2026-08-04');
      INSERT INTO workout_sets VALUES (1, 1, 1, 10, 10, 20, 1, '2026-08-03T10:20:00.000Z', '2026-08-03', '2026-08-03');
      INSERT INTO workout_sets VALUES (2, 1, 2, 10, 10, 30, 0, NULL, '2026-08-03', '2026-08-03');
      INSERT INTO workout_sets VALUES (3, 2, 1, 10, 10, 50, 1, '2026-08-04T10:02:00.000Z', '2026-08-04', '2026-08-04');
      INSERT INTO body_profiles VALUES (1, 100, 90, '2026-08-01', '2026-08-01');
      INSERT INTO body_measurements (measured_at, weight_kg, created_at, updated_at) VALUES ('2026-08-03T08:00:00.000Z', 100, '2026-08-03', '2026-08-03');
      INSERT INTO body_measurements (measured_at, weight_kg, created_at, updated_at) VALUES ('2026-08-05T08:00:00.000Z', 99, '2026-08-05', '2026-08-05');
    `);
    const summary = await createInsightsRepository(
      adapter(database)
    ).getSummary('week', new Date('2026-08-05T12:00:00.000Z'));
    expect(summary).toMatchObject({
      activeDays: 1,
      completedSets: 1,
      durationMinutes: 60,
      firstWeightKg: 100,
      latestWeightKg: 99,
      measurementCount: 2,
      totalRepetitions: 10,
      totalVolumeKg: 200,
      workouts: 1,
    });
    database.close();
  });

  it('returns a truthful empty-period state', async () => {
    const database = new DatabaseSync(':memory:');
    database.exec(migration001.sql);
    database.exec(migration002.sql);
    const summary = await createInsightsRepository(
      adapter(database)
    ).getSummary('year', new Date('2026-08-05T12:00:00.000Z'));
    expect(summary.workouts).toBe(0);
    expect(summary.firstWeightKg).toBeNull();
    expect(summary.points).toEqual([]);
    database.close();
  });
});
