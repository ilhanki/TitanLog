jest.mock('expo-crypto', () => {
  const crypto =
    jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { HEX: 'hex' },
    digestStringAsync: async (_algorithm: string, value: string) =>
      crypto.createHash('sha256').update(value, 'utf8').digest('hex'),
    randomUUID: crypto.randomUUID,
  };
});

import {
  createCanonicalSyncArchive,
  hashCanonicalArchive,
} from '@/features/sync/canonical-sync-archive';
import { serializeBackup } from '@/features/data-safety/backup-serialization';
import {
  createBackupSummary,
  validateBackup,
} from '@/features/data-safety/backup-validator';
import type {
  BackupData,
  TitanLogBackup,
} from '@/features/data-safety/backup-types';

const emptyData: BackupData = {
  workout_plans: [],
  workout_days: [],
  workout_day_schedules: [],
  exercises: [],
  workout_day_exercises: [],
  workout_sessions: [],
  workout_session_exercises: [],
  workout_sets: [],
  body_profiles: [],
  body_measurements: [],
};

function archive(overrides: Partial<TitanLogBackup> = {}): TitanLogBackup {
  return {
    appVersion: '0.1.0-alpha.10',
    createdAt: '2026-08-01T10:00:00.000Z',
    data: structuredClone(emptyData),
    deviceId: 'installation-one',
    format: 'titanlog-backup',
    formatVersion: 1,
    schemaVersion: 5,
    summary: createBackupSummary(emptyData),
    ...overrides,
  };
}

describe('canonical sync archive hashing', () => {
  it('produces identical bytes and SHA-256 across operation metadata changes', async () => {
    const first = serializeBackup(createCanonicalSyncArchive(archive()));
    const second = serializeBackup(
      createCanonicalSyncArchive(
        archive({
          appVersion: '0.1.0-alpha.11',
          createdAt: '2026-08-02T10:00:00.000Z',
          deviceId: 'another-device',
        })
      )
    );

    expect(second).toBe(first);
    expect(await hashCanonicalArchive(first)).toBe(
      await hashCanonicalArchive(second)
    );
    expect(await hashCanonicalArchive(first)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes the hash when validated user fitness data changes', async () => {
    const changed = structuredClone(emptyData);
    changed.body_profiles.push({
      id: 1,
      starting_weight_kg: 100,
      target_weight_kg: 90,
      created_at: '2026-08-01T10:00:00.000Z',
      updated_at: '2026-08-01T10:00:00.000Z',
    });
    changed.body_measurements.push({
      id: 1,
      measured_at: '2026-08-01T10:00:00.000Z',
      weight_kg: 100,
      waist_cm: null,
      chest_cm: null,
      upper_arm_cm: null,
      hip_cm: null,
      thigh_cm: null,
      note: null,
      created_at: '2026-08-01T10:00:00.000Z',
      updated_at: '2026-08-01T10:00:00.000Z',
    });
    const first = serializeBackup(createCanonicalSyncArchive(archive()));
    const secondArchive = archive({
      data: changed,
      summary: createBackupSummary(changed),
    });
    const second = serializeBackup(createCanonicalSyncArchive(secondArchive));

    expect(await hashCanonicalArchive(second)).not.toBe(
      await hashCanonicalArchive(first)
    );
    expect(validateBackup(secondArchive)).toEqual(secondArchive);
  });

  it('contains neither authentication nor sync bookkeeping fields', () => {
    const serialized = serializeBackup(createCanonicalSyncArchive(archive()));
    expect(serialized).not.toMatch(
      /access_token|refresh_token|sync_state|pending_operation|owner_account_id/i
    );
  });
});
