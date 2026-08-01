import type { SQLiteDatabase } from 'expo-sqlite';

import { normalizePersistedBackupRow } from '@/features/data-safety/backup-contract';
import {
  createBackupArchive,
  restoreBackupArchive,
} from '@/features/data-safety/backup-repository';
import {
  deserializeBackup,
  serializeBackup,
} from '@/features/data-safety/backup-serialization';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
  type BackupData,
  type TitanLogBackup,
} from '@/features/data-safety/backup-types';
import {
  BackupValidationError,
  createBackupSummary,
  validateBackup,
} from '@/features/data-safety/backup-validator';

const data: BackupData = {
  workout_plans: [
    {
      id: 1,
      name: 'Plan',
      description: '',
      is_active: 1,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    },
  ],
  workout_days: [
    {
      id: 2,
      plan_id: 1,
      name: 'Gün',
      subtitle: '',
      sort_order: 1,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    },
  ],
  workout_day_schedules: [{ id: 3, workout_day_id: 2, iso_weekday: 5 }],
  exercises: [
    {
      id: 4,
      name: 'Row',
      muscle_group: 'Sırt',
      equipment: 'Cable',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    },
  ],
  workout_day_exercises: [
    {
      id: 5,
      workout_day_id: 2,
      exercise_id: 4,
      sort_order: 1,
      default_set_count: 3,
      default_target_reps: 12,
      default_weight_kg: 40,
      weight_mode: 'total',
    },
  ],
  workout_sessions: [
    {
      id: 6,
      workout_day_id: 2,
      workout_name_snapshot: 'Gün',
      status: 'completed',
      started_at: '2026-07-02T10:00:00.000Z',
      completed_at: '2026-07-02T11:00:00.000Z',
      cancelled_at: null,
      created_at: '2026-07-02T10:00:00.000Z',
      updated_at: '2026-07-02T11:00:00.000Z',
    },
    {
      id: 7,
      workout_day_id: 2,
      workout_name_snapshot: 'Gün',
      status: 'cancelled',
      started_at: '2026-07-03T10:00:00.000Z',
      completed_at: null,
      cancelled_at: '2026-07-03T10:05:00.000Z',
      created_at: '2026-07-03T10:00:00.000Z',
      updated_at: '2026-07-03T10:05:00.000Z',
    },
    {
      id: 8,
      workout_day_id: 2,
      workout_name_snapshot: 'Gün',
      status: 'active',
      started_at: '2026-07-04T10:00:00.000Z',
      completed_at: null,
      cancelled_at: null,
      created_at: '2026-07-04T10:00:00.000Z',
      updated_at: '2026-07-04T10:00:00.000Z',
    },
  ],
  workout_session_exercises: [
    {
      id: 9,
      session_id: 6,
      exercise_id: 4,
      exercise_name_snapshot: 'Row',
      muscle_group_snapshot: 'Sırt',
      weight_mode_snapshot: 'total',
      sort_order: 1,
      created_at: '2026-07-02T10:00:00.000Z',
    },
  ],
  workout_sets: [
    {
      id: 10,
      session_exercise_id: 9,
      set_number: 1,
      target_reps: 12,
      actual_reps: 12,
      weight_kg: 40,
      is_completed: 1,
      completed_at: '2026-07-02T10:10:00.000Z',
      created_at: '2026-07-02T10:00:00.000Z',
      updated_at: '2026-07-02T10:10:00.000Z',
    },
  ],
  body_profiles: [
    {
      id: 1,
      starting_weight_kg: 120,
      target_weight_kg: 100,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    },
  ],
  body_measurements: [
    {
      id: 11,
      measured_at: '2026-07-01T00:00:00.000Z',
      weight_kg: 120,
      waist_cm: 100,
      chest_cm: null,
      upper_arm_cm: null,
      hip_cm: null,
      thigh_cm: null,
      note: 'Başlangıç',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    },
  ],
};

function archive(overrides: Partial<TitanLogBackup> = {}): TitanLogBackup {
  return {
    appVersion: '0.1.0-alpha.10',
    createdAt: '2026-07-31T10:00:00.000Z',
    data,
    deviceId: 'installation-123',
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    summary: createBackupSummary(data),
    ...overrides,
  };
}

describe('versioned backup safety', () => {
  it('validates a complete archive and summarizes truthful records', () => {
    expect(validateBackup(archive()).summary).toEqual({
      exercises: 1,
      measurements: 1,
      programs: 1,
      sets: 1,
      workouts: 3,
    });
  });

  it('serializes deterministically and preserves active, completed, and cancelled sessions', () => {
    const serialized = serializeBackup(archive());
    expect(serializeBackup(deserializeBackup(serialized))).toBe(serialized);
    expect(
      deserializeBackup(serialized).data.workout_sessions.map(
        (row) => row.status
      )
    ).toEqual(['completed', 'cancelled', 'active']);
  });

  it.each([
    ['unknown_format', { format: 'other' }],
    ['newer_format', { formatVersion: 2 }],
  ])('rejects %s', (_name, override) => {
    expect(() => validateBackup({ ...archive(), ...override })).toThrow(
      BackupValidationError
    );
  });

  it('rejects malformed JSON, secret-bearing envelopes, and missing relationships', () => {
    expect(() => deserializeBackup('{')).toThrow(BackupValidationError);
    expect(() =>
      deserializeBackup(
        JSON.stringify({ ...archive(), access_token: 'secret' })
      )
    ).toThrow(BackupValidationError);
    const broken = structuredClone(data);
    broken.workout_days[0]!.plan_id = 999;
    expect(() =>
      validateBackup(
        archive({ data: broken, summary: createBackupSummary(broken) })
      )
    ).toThrow('missing_relationship');
  });

  it('preserves a schema-valid legacy workout day without a schedule', () => {
    const unscheduled = structuredClone(data);
    unscheduled.workout_day_schedules = [];
    expect(
      validateBackup(
        archive({
          data: unscheduled,
          summary: createBackupSummary(unscheduled),
        })
      ).data.workout_days
    ).toHaveLength(1);
  });

  it('reports a safe field path without exposing a malformed value', () => {
    const malformed = structuredClone(data) as unknown as BackupData;
    delete malformed.body_measurements[0]!.note;
    try {
      validateBackup(
        archive({
          data: malformed,
          summary: createBackupSummary(malformed),
        })
      );
      throw new Error('expected_validation_failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BackupValidationError);
      expect((error as BackupValidationError).issue).toEqual({
        actual: 'undefined',
        code: 'missing_field',
        expected: 'string|null',
        path: 'data.body_measurements[0].note',
        recordIndex: 0,
        section: 'data',
        table: 'body_measurements',
      });
    }
  });

  it('rejects undefined in a required canonical field', () => {
    const malformed = structuredClone(data) as unknown as BackupData;
    delete malformed.body_measurements[0]!.weight_kg;
    expect(() =>
      validateBackup(
        archive({
          data: malformed,
          summary: createBackupSummary(malformed),
        })
      )
    ).toThrow('missing_field');
  });

  it('canonicalizes absent nullable fields without coercing required values', () => {
    const persisted = {
      ...data.body_measurements[0],
      note: undefined,
      waist_cm: undefined,
    };
    const normalized = normalizePersistedBackupRow(
      'body_measurements',
      persisted
    );
    expect(normalized.note).toBeNull();
    expect(normalized.waist_cm).toBeNull();
    expect(normalized.weight_kg).toBe(120);

    const invalidNumber = {
      ...normalized,
      weight_kg: '120',
    };
    const malformed = structuredClone(data);
    malformed.body_measurements = [invalidNumber];
    expect(() =>
      validateBackup(
        archive({
          data: malformed,
          summary: createBackupSummary(malformed),
        })
      )
    ).toThrow('invalid_value');
  });

  it('rejects non-finite numeric fields and incorrect summaries', () => {
    const invalidNumber = structuredClone(data);
    invalidNumber.workout_sets[0]!.weight_kg = Number.NaN;
    expect(() =>
      validateBackup(
        archive({
          data: invalidNumber,
          summary: createBackupSummary(invalidNumber),
        })
      )
    ).toThrow('invalid_value');
    expect(() =>
      validateBackup(
        archive({
          summary: { ...createBackupSummary(data), workouts: 999 },
        })
      )
    ).toThrow('invalid_summary');
  });

  it('exports every table inside one consistent transaction', async () => {
    let statementInProgress = false;
    const transaction = {
      getFirstAsync: jest
        .fn()
        .mockResolvedValue({ installation_id: 'installation-123' }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (statementInProgress) throw new Error('concurrent_statement');
        statementInProgress = true;
        await Promise.resolve();
        const table = Object.keys(data).find((name) =>
          sql.includes(`FROM ${name}`)
        );
        statementInProgress = false;
        return table ? data[table as keyof BackupData] : [];
      }),
    };
    const database = {
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase;
    const result = await createBackupArchive(database);
    expect(result.summary.workouts).toBe(3);
    expect(transaction.getAllAsync).toHaveBeenCalledTimes(10);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('restores by deleting and inserting only fixed tables in one exclusive transaction', async () => {
    const transaction = {
      getAllAsync: jest.fn().mockResolvedValue([]),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };
    const database = {
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase;
    await restoreBackupArchive(database, archive());
    const sql = transaction.runAsync.mock.calls
      .map(([statement]) => statement)
      .join('\n');
    expect(sql).toContain('DELETE FROM workout_sets');
    expect(sql).toContain('INSERT INTO body_measurements');
    expect(transaction.getAllAsync).toHaveBeenCalledWith(
      'PRAGMA foreign_key_check'
    );
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('propagates a restore failure so the exclusive transaction can roll back', async () => {
    const transaction = {
      getAllAsync: jest.fn(),
      runAsync: jest.fn().mockRejectedValue(new Error('disk full')),
    };
    const database = {
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase;
    await expect(restoreBackupArchive(database, archive())).rejects.toThrow(
      'disk full'
    );
  });
});
