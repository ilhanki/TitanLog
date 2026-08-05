import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { migration001 } from '@/database/migrations/migration-001';
import { migration002 } from '@/database/migrations/migration-002';
import { migration003 } from '@/database/migrations/migration-003';
import { migration004 } from '@/database/migrations/migration-004';
import { migration005 } from '@/database/migrations/migration-005';
import { migration006 } from '@/database/migrations/migration-006';
import { migration007 } from '@/database/migrations/migration-007';
import {
  createBackupArchive,
  replaceBackupData,
  restoreBackupArchive,
} from '@/features/data-safety/backup-repository';
import {
  deserializeBackup,
  serializeBackup,
} from '@/features/data-safety/backup-serialization';
import { validateBackup } from '@/features/data-safety/backup-validator';
import { createSyncStateRepository } from '@/features/sync/sync-state-repository';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';

type SQLiteParameter = bigint | null | number | string | Uint8Array;

class MigratedSchema4Fixture {
  readonly native = new DatabaseSync(':memory:');

  constructor() {
    this.native.exec('PRAGMA foreign_keys = ON');
  }

  close(): void {
    this.native.close();
  }

  exec(sql: string): void {
    this.native.exec(sql);
  }

  async getAllAsync<T>(
    sql: string,
    ...params: SQLiteParameter[]
  ): Promise<T[]> {
    return this.native.prepare(sql).all(...params) as T[];
  }

  async getFirstAsync<T>(
    sql: string,
    ...params: SQLiteParameter[]
  ): Promise<T | null> {
    return (this.native.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async runAsync(sql: string, ...params: SQLiteParameter[]) {
    const result = this.native.prepare(sql).run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async withExclusiveTransactionAsync(
    operation: (transaction: SQLiteDatabase) => Promise<void>
  ): Promise<void> {
    this.native.exec('BEGIN EXCLUSIVE');
    try {
      await operation(this as unknown as SQLiteDatabase);
      this.native.exec('COMMIT');
    } catch (error) {
      this.native.exec('ROLLBACK');
      throw error;
    }
  }
}

function migrateThroughVersion3(fixture: MigratedSchema4Fixture): void {
  for (const migration of [migration001, migration002, migration003]) {
    fixture.exec(migration.sql);
    fixture.exec(`PRAGMA user_version = ${migration.version}`);
  }
}

function migrateToVersion4(fixture: MigratedSchema4Fixture): void {
  fixture.exec(migration004.sql);
  fixture.exec(`PRAGMA user_version = ${migration004.version}`);
  fixture.exec(`
    UPDATE dataset_metadata
    SET installation_id = 'fixture-installation-0001',
        owner_account_id = NULL,
        updated_at = '2026-07-31T09:00:00.000Z'
    WHERE id = 1;
  `);
}

function migrateToVersion5(fixture: MigratedSchema4Fixture): void {
  fixture.exec(migration005.sql);
  fixture.exec(`PRAGMA user_version = ${migration005.version}`);
}

function migrateToCurrentVersion(fixture: MigratedSchema4Fixture): void {
  for (const migration of [migration006, migration007]) {
    fixture.exec(migration.sql);
    fixture.exec(`PRAGMA user_version = ${migration.version}`);
  }
}

function seedAlpha9Dataset(fixture: MigratedSchema4Fixture): void {
  fixture.exec(`
    INSERT INTO workout_plans
      (id, name, description, is_active, created_at, updated_at)
    VALUES
      (1, 'Primary plan', '', 1, '2026-07-01T08:00:00.000Z', '2026-07-01T08:00:00.000Z');

    INSERT INTO workout_days
      (id, plan_id, name, subtitle, sort_order, created_at, updated_at)
    VALUES
      (1, 1, 'Scheduled day', '', 1, '2026-07-01T08:00:00.000Z', '2026-07-01T08:00:00.000Z'),
      (2, 1, 'Legacy unscheduled day', '', 2, '2026-07-01T08:00:00.000Z', '2026-07-01T08:00:00.000Z');

    INSERT INTO workout_day_schedules (id, workout_day_id, iso_weekday)
    VALUES (1, 1, 5);

    INSERT INTO exercises
      (id, name, muscle_group, equipment, created_at, updated_at)
    VALUES
      (1, 'Current exercise', 'Group', 'Machine', '2026-07-01T08:00:00.000Z', '2026-07-01T08:00:00.000Z'),
      (2, 'Historical exercise', 'Group', '', '2026-07-01T08:00:00.000Z', '2026-07-01T08:00:00.000Z'),
      (3, 'Custom exercise', '', '', '2026-07-02T08:00:00.000Z', '2026-07-02T08:00:00.000Z');

    INSERT INTO workout_day_exercises
      (id, workout_day_id, exercise_id, sort_order, default_set_count,
       default_target_reps, default_weight_kg, weight_mode)
    VALUES
      (1, 1, 1, 1, 3, 12, 40, 'total'),
      (2, 1, 3, 2, 2, 10, 0, 'per_hand');

    INSERT INTO workout_sessions
      (id, workout_day_id, workout_name_snapshot, status, started_at,
       completed_at, cancelled_at, created_at, updated_at)
    VALUES
      (1, 1, 'Scheduled day', 'active', '2026-07-31T10:00:00.000Z', NULL, NULL, '2026-07-31T10:00:00.000Z', '2026-07-31T10:00:00.000Z'),
      (2, 1, 'Scheduled day', 'completed', '2026-07-30T10:00:00.000Z', '2026-07-30T11:00:00.000Z', NULL, '2026-07-30T10:00:00.000Z', '2026-07-30T11:00:00.000Z'),
      (3, 1, 'Scheduled day', 'cancelled', '2026-07-29T10:00:00.000Z', NULL, '2026-07-29T10:30:00.000Z', '2026-07-29T10:00:00.000Z', '2026-07-29T10:30:00.000Z');

    INSERT INTO workout_session_exercises
      (id, session_id, exercise_id, exercise_name_snapshot,
       muscle_group_snapshot, weight_mode_snapshot, sort_order, created_at)
    VALUES
      (1, 1, 1, 'Current exercise', 'Group', 'total', 1, '2026-07-31T10:00:00.000Z'),
      (2, 2, 2, 'Removed historical snapshot', 'Group', 'total', 1, '2026-07-30T10:00:00.000Z'),
      (3, 3, 3, 'Custom exercise', '', 'per_hand', 1, '2026-07-29T10:00:00.000Z');

    INSERT INTO workout_sets
      (id, session_exercise_id, set_number, target_reps, actual_reps,
       weight_kg, is_completed, completed_at, created_at, updated_at)
    VALUES
      (1, 1, 1, 12, NULL, 0, 0, NULL, '2026-07-31T10:00:00.000Z', '2026-07-31T10:00:00.000Z'),
      (2, 2, 1, 12, 12, 40, 1, '2026-07-30T10:20:00.000Z', '2026-07-30T10:00:00.000Z', '2026-07-30T10:20:00.000Z'),
      (3, 3, 1, 10, 8, 12.5, 1, '2026-07-29T10:15:00.000Z', '2026-07-29T10:00:00.000Z', '2026-07-29T10:15:00.000Z');

    INSERT INTO body_profiles
      (id, starting_weight_kg, target_weight_kg, created_at, updated_at)
    VALUES
      (1, 119.6, 99.9, '2026-07-01T08:00:00.000Z', '2026-07-01T08:00:00.000Z');

    INSERT INTO body_measurements
      (id, measured_at, weight_kg, waist_cm, chest_cm, upper_arm_cm,
       hip_cm, thigh_cm, note, created_at, updated_at)
    VALUES
      (1, '2026-07-01T08:00:00.000Z', 119.6, NULL, NULL, NULL, NULL, NULL, '', '2026-07-01T08:00:00.000Z', '2026-07-01T08:00:00.000Z'),
      (2, '2026-07-15T08:00:00.000Z', 116.2, 105, 110, 38, 108, 61, 'Progress note', '2026-07-15T08:00:00.000Z', '2026-07-15T08:00:00.000Z');
  `);
}

describe('schema-4 backup round trip', () => {
  let fixture: MigratedSchema4Fixture;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00.000Z'));
    fixture = new MigratedSchema4Fixture();
    migrateThroughVersion3(fixture);
    seedAlpha9Dataset(fixture);
    migrateToVersion4(fixture);
    migrateToVersion5(fixture);
    migrateToCurrentVersion(fixture);
  });

  afterEach(() => {
    fixture.close();
    jest.useRealTimers();
  });

  it('validates and deterministically round-trips a realistic migrated guest dataset', async () => {
    const database = fixture as unknown as SQLiteDatabase;
    const before = await fixture.getFirstAsync<{ changes: number }>(
      'SELECT total_changes() AS changes'
    );
    const first = await createBackupArchive(database);
    const second = await createBackupArchive(database);
    const after = await fixture.getFirstAsync<{ changes: number }>(
      'SELECT total_changes() AS changes'
    );
    const serialized = serializeBackup(first);

    expect(second).toEqual(first);
    expect(after).toEqual(before);
    expect(validateBackup(first)).toEqual(first);
    expect(serializeBackup(deserializeBackup(serialized))).toBe(serialized);
    expect(first.data.workout_days.map((row) => row.sort_order)).toEqual([
      1, 2,
    ]);
    expect(first.data.workout_day_schedules).toHaveLength(1);
    expect(first.data.workout_sessions.map((row) => row.status)).toEqual([
      'active',
      'completed',
      'cancelled',
    ]);
    expect(
      first.data.workout_session_exercises[1]?.exercise_name_snapshot
    ).toBe('Removed historical snapshot');
    expect(first.data.body_measurements[0]).toMatchObject({
      chest_cm: null,
      note: '',
      waist_cm: null,
    });
    expect(first.summary).toEqual({
      exercises: 3,
      measurements: 2,
      programs: 1,
      sets: 2,
      workouts: 3,
    });
    expect(first.data.workout_sessions.some((row) => row.id === 4)).toBe(false);
    expect(serialized).not.toMatch(
      /access_token|refresh_token|owner_account_id|session_token/i
    );
  });

  it('exports a fresh schema-4 profile with its initial nullable measurement', async () => {
    const fresh = new MigratedSchema4Fixture();
    try {
      for (const migration of [
        migration001,
        migration002,
        migration003,
        migration004,
        migration005,
        migration006,
        migration007,
      ]) {
        fresh.exec(migration.sql);
      }
      fresh.exec(`
        INSERT INTO body_profiles
          (id, starting_weight_kg, target_weight_kg, created_at, updated_at)
        VALUES
          (1, 90, 80, '2026-08-01T12:00:00.000Z', '2026-08-01T12:00:00.000Z');
        INSERT INTO body_measurements
          (id, measured_at, weight_kg, created_at, updated_at)
        VALUES
          (1, '2026-08-01T12:00:00.000Z', 90, '2026-08-01T12:00:00.000Z', '2026-08-01T12:00:00.000Z');
      `);
      const archive = await createBackupArchive(
        fresh as unknown as SQLiteDatabase
      );
      expect(archive.summary.measurements).toBe(1);
      expect(archive.data.body_measurements[0]).toMatchObject({
        chest_cm: null,
        hip_cm: null,
        note: null,
        thigh_cm: null,
        upper_arm_cm: null,
        waist_cm: null,
      });
      expect(validateBackup(archive)).toEqual(archive);
    } finally {
      fresh.close();
    }
  });

  it('omits legacy orphaned session snapshots without mutating the database', async () => {
    fixture.exec('PRAGMA foreign_keys = OFF');
    fixture.exec(`
      INSERT INTO workout_session_exercises
        (id, session_id, exercise_id, exercise_name_snapshot,
         muscle_group_snapshot, weight_mode_snapshot, sort_order, created_at)
      VALUES
        (99, 999, 1, 'Detached snapshot', 'Group', 'total', 1,
         '2026-07-28T10:00:00.000Z');

      INSERT INTO workout_sets
        (id, session_exercise_id, set_number, target_reps, actual_reps,
         weight_kg, is_completed, completed_at, created_at, updated_at)
      VALUES
        (99, 99, 1, 10, 10, 20, 1, '2026-07-28T10:10:00.000Z',
         '2026-07-28T10:00:00.000Z', '2026-07-28T10:10:00.000Z');
    `);
    fixture.exec('PRAGMA foreign_keys = ON');
    const before = await fixture.getFirstAsync<{ changes: number }>(
      'SELECT total_changes() AS changes'
    );

    const archive = await createBackupArchive(
      fixture as unknown as SQLiteDatabase
    );

    const after = await fixture.getFirstAsync<{ changes: number }>(
      'SELECT total_changes() AS changes'
    );
    const persistedOrphan = await fixture.getFirstAsync<{ id: number }>(
      'SELECT id FROM workout_session_exercises WHERE id = 99'
    );
    expect(after).toEqual(before);
    expect(persistedOrphan).toEqual({ id: 99 });
    expect(
      archive.data.workout_session_exercises.some((row) => row.id === 99)
    ).toBe(false);
    expect(archive.data.workout_sets.some((row) => row.id === 99)).toBe(false);
    expect(validateBackup(archive)).toEqual(archive);
  });

  it('deletes completed session descendants when foreign-key cascades are disabled', async () => {
    fixture.exec('PRAGMA foreign_keys = OFF');

    await createWorkoutSessionRepository(
      fixture as unknown as SQLiteDatabase
    ).deleteCompletedSession(2);

    const sessions = await fixture.getAllAsync<{ id: number }>(
      'SELECT id FROM workout_sessions ORDER BY id'
    );
    const sessionExercises = await fixture.getAllAsync<{
      id: number;
      session_id: number;
    }>('SELECT id, session_id FROM workout_session_exercises ORDER BY id');
    const sets = await fixture.getAllAsync<{
      id: number;
      session_exercise_id: number;
    }>('SELECT id, session_exercise_id FROM workout_sets ORDER BY id');

    expect(sessions).toEqual([{ id: 1 }, { id: 3 }]);
    expect(sessionExercises).toEqual([
      { id: 1, session_id: 1 },
      { id: 3, session_id: 3 },
    ]);
    expect(sets).toEqual([
      { id: 1, session_exercise_id: 1 },
      { id: 3, session_exercise_id: 3 },
    ]);
  });

  it('keeps ownership metadata private for guest and claimed datasets', async () => {
    const database = fixture as unknown as SQLiteDatabase;
    const guest = serializeBackup(await createBackupArchive(database));
    await fixture.runAsync(
      'UPDATE dataset_metadata SET owner_account_id = ? WHERE id = 1',
      'private-account-id'
    );
    const claimed = serializeBackup(await createBackupArchive(database));

    expect(guest).not.toContain('owner_account_id');
    expect(claimed).not.toContain('private-account-id');
    expect(deserializeBackup(claimed).format).toBe('titanlog-backup');
  });

  it('restores its own validated archive without changing the canonical data', async () => {
    const archive = await createBackupArchive(
      fixture as unknown as SQLiteDatabase
    );
    const target = new MigratedSchema4Fixture();
    try {
      for (const migration of [
        migration001,
        migration002,
        migration003,
        migration004,
        migration005,
        migration006,
        migration007,
      ]) {
        target.exec(migration.sql);
        target.exec(`PRAGMA user_version = ${migration.version}`);
      }
      await restoreBackupArchive(
        target as unknown as SQLiteDatabase,
        deserializeBackup(serializeBackup(archive))
      );
      const restored = await createBackupArchive(
        target as unknown as SQLiteDatabase
      );
      expect(restored.data).toEqual(archive.data);
      expect(restored.summary).toEqual(archive.summary);
    } finally {
      target.close();
    }
  });

  it('keeps schema-5 sync bookkeeping outside schema-4 archives', async () => {
    await fixture.runAsync(
      `UPDATE sync_state
       SET last_remote_revision = 7,
           last_remote_content_hash = ?, last_local_content_hash = ?,
           last_successful_sync_at = ?, pending_operation_id = ?
       WHERE id = 1`,
      'a'.repeat(64),
      'b'.repeat(64),
      '2026-08-01T12:00:00.000Z',
      '123e4567-e89b-12d3-a456-426614174000'
    );

    const archive = await createBackupArchive(
      fixture as unknown as SQLiteDatabase
    );
    const serialized = serializeBackup(archive);

    expect(archive.schemaVersion).toBe(5);
    expect(serialized).not.toMatch(
      /sync_state|last_remote|pending_operation|123e4567/
    );
    expect(validateBackup(archive)).toEqual(archive);
  });

  it('replaces fitness data and advances sync state in one real transaction', async () => {
    const archive = await createBackupArchive(
      fixture as unknown as SQLiteDatabase
    );
    const target = new MigratedSchema4Fixture();
    try {
      for (const migration of [
        migration001,
        migration002,
        migration003,
        migration004,
        migration005,
        migration006,
        migration007,
      ]) {
        target.exec(migration.sql);
      }
      const transactionSpy = jest.spyOn(
        target,
        'withExclusiveTransactionAsync'
      );
      await target.withExclusiveTransactionAsync(async (transaction) => {
        await replaceBackupData(transaction, archive);
        await createSyncStateRepository(transaction).recordSuccess(
          5,
          'a'.repeat(64),
          'a'.repeat(64),
          '2026-08-01T12:00:00.000Z'
        );
      });
      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(
        await target.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM workout_sessions'
        )
      ).toEqual({ count: 3 });
      expect(
        await createSyncStateRepository(
          target as unknown as SQLiteDatabase
        ).getState()
      ).toMatchObject({
        lastRemoteRevision: 5,
        lastRemoteContentHash: 'a'.repeat(64),
        lastLocalContentHash: 'a'.repeat(64),
      });
      expect(await target.getAllAsync('PRAGMA foreign_key_check')).toHaveLength(
        0
      );
    } finally {
      target.close();
    }
  });

  it('rolls back a real replacement before sync state can advance', async () => {
    const archive = await createBackupArchive(
      fixture as unknown as SQLiteDatabase
    );
    await expect(
      fixture.withExclusiveTransactionAsync(async (transaction) => {
        await replaceBackupData(transaction, {
          ...archive,
          data: Object.fromEntries(
            Object.keys(archive.data).map((table) => [table, []])
          ) as unknown as typeof archive.data,
          summary: {
            exercises: 0,
            measurements: 0,
            programs: 0,
            sets: 0,
            workouts: 0,
          },
        });
        throw new Error('simulated_crash');
      })
    ).rejects.toThrow('simulated_crash');
    expect(
      await fixture.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_sessions'
      )
    ).toEqual({ count: 3 });
    expect(
      await createSyncStateRepository(
        fixture as unknown as SQLiteDatabase
      ).getState()
    ).toMatchObject({
      lastRemoteRevision: null,
    });
  });
});
