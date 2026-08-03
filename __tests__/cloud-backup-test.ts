import type { SQLiteDatabase } from 'expo-sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  downloadCloudBackup,
  uploadCloudBackup,
} from '@/features/data-safety/cloud-backup-service';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';

const userId = '123e4567-e89b-12d3-a456-426614174000';
const backup: TitanLogBackup = {
  appVersion: '0.1.0-alpha.10',
  createdAt: '2026-07-31T10:00:00.000Z',
  data: {
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
  },
  deviceId: 'installation-123',
  format: 'titanlog-backup',
  formatVersion: 1,
  schemaVersion: 4,
  summary: { exercises: 0, measurements: 0, programs: 0, sets: 0, workouts: 0 },
};
const mockUpload = jest.fn();
const mockDownload = jest.fn();
const mockGetUser = jest.fn();
const mockMetadataUpsert = jest.fn();
const mockMetadataSingle = jest.fn();
const mockMetadataEq = jest.fn(() => ({ single: mockMetadataSingle }));
const mockMetadataSelect = jest.fn(() => ({ eq: mockMetadataEq }));
const mockHashCanonicalArchive = jest.fn();
const mockFrom = jest.fn(() => ({
  upload: mockUpload,
  download: mockDownload,
}));

jest.mock('@/features/auth/supabase-client', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: mockGetUser },
    from: jest.fn(() => ({
      select: mockMetadataSelect,
      upsert: mockMetadataUpsert,
    })),
    storage: { from: mockFrom },
  }),
}));
jest.mock('@/features/sync/canonical-sync-archive', () => ({
  hashCanonicalArchive: (...args: unknown[]) =>
    mockHashCanonicalArchive(...args),
}));
jest.mock('@/features/data-safety/backup-repository', () => ({
  createBackupArchive: jest.fn().mockResolvedValue(backup),
}));

function database(owner = userId) {
  return {
    getFirstAsync: jest.fn().mockResolvedValue({
      installation_id: 'installation-123',
      last_cloud_backup_at: null,
      last_local_backup_at: null,
      owner_account_id: owner,
    }),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  } as unknown as SQLiteDatabase;
}

describe('manual private cloud backup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHashCanonicalArchive.mockReset();
    mockMetadataSingle.mockReset();
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockUpload.mockResolvedValue({ error: null });
    mockMetadataUpsert.mockResolvedValue({ error: null });
    const serialized = JSON.stringify(backup);
    mockHashCanonicalArchive.mockResolvedValue('a'.repeat(64));
    mockMetadataSingle.mockResolvedValue({
      data: {
        byte_size: new TextEncoder().encode(serialized).byteLength,
        content_hash: 'a'.repeat(64),
      },
      error: null,
    });
    mockDownload.mockResolvedValue({
      data: { text: jest.fn().mockResolvedValue(serialized) },
      error: null,
    });
  });

  it('uploads only to the authenticated user namespace after ownership claim', async () => {
    await uploadCloudBackup(database());
    expect(mockFrom).toHaveBeenCalledWith('titanlog-backups');
    expect(mockUpload).toHaveBeenCalledWith(
      `${userId}/latest.titanlog`,
      expect.any(ArrayBuffer),
      expect.objectContaining({ upsert: true })
    );
    expect(mockMetadataUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        byte_size: expect.any(Number),
        content_hash: 'a'.repeat(64),
        user_id: userId,
      }),
      { onConflict: 'user_id' }
    );
  });

  it('downloads and validates only the authenticated user path', async () => {
    await expect(downloadCloudBackup(database())).resolves.toMatchObject({
      format: 'titanlog-backup',
    });
    expect(mockDownload).toHaveBeenCalledWith(`${userId}/latest.titanlog`);
    expect(mockMetadataSelect).toHaveBeenCalledWith('byte_size, content_hash');
    expect(mockMetadataEq).toHaveBeenCalledWith('user_id', userId);
    expect(mockHashCanonicalArchive).toHaveBeenCalledWith(
      JSON.stringify(backup)
    );
  });

  it.each([
    ['size', { byte_size: 1, content_hash: 'a'.repeat(64) }, 'a'.repeat(64)],
    [
      'hash',
      {
        byte_size: new TextEncoder().encode(JSON.stringify(backup)).byteLength,
        content_hash: 'a'.repeat(64),
      },
      'b'.repeat(64),
    ],
  ])(
    'rejects a cloud backup %s mismatch before preview',
    async (_, metadata, hash) => {
      mockMetadataSingle.mockResolvedValueOnce({ data: metadata, error: null });
      mockHashCanonicalArchive.mockResolvedValueOnce(hash);
      await expect(downloadCloudBackup(database())).rejects.toMatchObject({
        code: 'validation_failure',
      });
    }
  );

  it('blocks unauthenticated and foreign-owner cloud access before storage', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(uploadCloudBackup(database())).rejects.toMatchObject({
      code: 'not_authenticated',
    });
    await expect(
      uploadCloudBackup(database('other-account'))
    ).rejects.toMatchObject({ code: 'owner_mismatch' });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('keeps local metadata unchanged when upload fails', async () => {
    const db = database();
    mockUpload.mockResolvedValue({ error: new Error('offline') });
    await expect(uploadCloudBackup(db)).rejects.toMatchObject({
      code: 'remote_failure',
    });
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('defines constrained owner-scoped integrity metadata', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/202608030001_backup_integrity_metadata.sql'
      ),
      'utf8'
    );
    expect(sql).toContain('add column if not exists byte_size bigint');
    expect(sql).toContain('add column if not exists content_hash text');
    expect(sql).toContain("content_hash ~ '^[0-9a-f]{64}$'");
    expect(sql).not.toMatch(/disable row level security|create policy/i);
  });
});
