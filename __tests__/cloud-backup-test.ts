import type { SQLiteDatabase } from 'expo-sqlite';

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
const mockFrom = jest.fn(() => ({
  upload: mockUpload,
  download: mockDownload,
}));

jest.mock('@/features/auth/supabase-client', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: mockGetUser },
    from: jest.fn(() => ({ upsert: mockMetadataUpsert })),
    storage: { from: mockFrom },
  }),
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
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockUpload.mockResolvedValue({ error: null });
    mockMetadataUpsert.mockResolvedValue({ error: null });
    mockDownload.mockResolvedValue({
      data: { text: jest.fn().mockResolvedValue(JSON.stringify(backup)) },
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
      expect.objectContaining({ user_id: userId }),
      { onConflict: 'user_id' }
    );
  });

  it('downloads and validates only the authenticated user path', async () => {
    await expect(downloadCloudBackup(database())).resolves.toMatchObject({
      format: 'titanlog-backup',
    });
    expect(mockDownload).toHaveBeenCalledWith(`${userId}/latest.titanlog`);
  });

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
});
