import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SQLiteDatabase } from 'expo-sqlite';

import { serializeBackup } from '@/features/data-safety/backup-serialization';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';

const userId = '123e4567-e89b-12d3-a456-426614174000';
const backup: TitanLogBackup = {
  appVersion: '0.1.0-alpha.11',
  createdAt: '2026-08-03T10:00:00.000Z',
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
  schemaVersion: 5,
  summary: { exercises: 0, measurements: 0, programs: 0, sets: 0, workouts: 0 },
};
const mockUpload = jest.fn();
const mockDownload = jest.fn();
const mockGetUser = jest.fn();
const mockMetadataUpsert = jest.fn();
const mockMetadataMaybeSingle = jest.fn();
const mockMetadataEq = jest.fn(() => ({
  maybeSingle: mockMetadataMaybeSingle,
}));
const mockMetadataSelect = jest.fn(() => ({ eq: mockMetadataEq }));
const mockHashCanonicalArchive = jest.fn((value: string) =>
  Promise.resolve(createHash('sha256').update(value, 'utf8').digest('hex'))
);
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
  hashCanonicalArchive: (value: string) => mockHashCanonicalArchive(value),
}));
jest.mock('@/features/data-safety/backup-repository', () => ({
  createBackupArchive: jest.fn().mockResolvedValue(backup),
}));

import {
  downloadCloudBackup,
  readCloudBackupBlob,
  uploadCloudBackup,
} from '@/features/data-safety/cloud-backup-service';

type AndroidBlob = Blob & { androidText: string };

function androidBlob(value: string): AndroidBlob {
  return {
    androidText: value,
    size: new TextEncoder().encode(value).byteLength,
    type: 'application/json',
  } as AndroidBlob;
}

class AndroidFileReader {
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  result: string | ArrayBuffer | null = null;

  readAsText(blob: AndroidBlob): void {
    this.result = blob.androidText;
    this.onload?.();
  }
}

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

function metadataFor(serialized: string) {
  return {
    byte_size: new TextEncoder().encode(serialized).byteLength,
    content_hash: createHash('sha256').update(serialized, 'utf8').digest('hex'),
  };
}

function expectDiagnostic(error: unknown, stage: string, code: string): void {
  expect(error).toMatchObject({ diagnostic: { code, stage } });
}

describe('manual private cloud backup', () => {
  const serialized = serializeBackup(backup);
  let consoleWarn: jest.SpyInstance;

  beforeAll(() => {
    Object.defineProperty(global, 'FileReader', {
      configurable: true,
      value: AndroidFileReader,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockHashCanonicalArchive.mockImplementation((value: string) =>
      Promise.resolve(createHash('sha256').update(value, 'utf8').digest('hex'))
    );
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockUpload.mockResolvedValue({ error: null });
    mockMetadataUpsert.mockResolvedValue({ error: null });
    mockMetadataMaybeSingle.mockResolvedValue({
      data: metadataFor(serialized),
      error: null,
    });
    mockDownload.mockResolvedValue({
      data: androidBlob(serialized),
      error: null,
    });
  });

  afterEach(() => consoleWarn.mockRestore());

  it('round-trips uploaded bytes and integrity metadata through the Android Blob shape', async () => {
    const db = database();
    await uploadCloudBackup(db);
    const uploadedBuffer = mockUpload.mock.calls[0][1] as ArrayBuffer;
    const uploaded = new TextDecoder().decode(uploadedBuffer);
    const persisted = mockMetadataUpsert.mock.calls[0][0];
    mockMetadataMaybeSingle.mockResolvedValueOnce({
      data: {
        byte_size: persisted.byte_size,
        content_hash: persisted.content_hash,
      },
      error: null,
    });
    mockDownload.mockResolvedValueOnce({
      data: androidBlob(uploaded),
      error: null,
    });

    await expect(downloadCloudBackup(db)).resolves.toEqual(backup);
    expect(mockUpload).toHaveBeenCalledWith(
      `${userId}/latest.titanlog`,
      expect.any(ArrayBuffer),
      expect.objectContaining({ upsert: true })
    );
    expect(mockMetadataEq).toHaveBeenCalledWith('user_id', userId);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('converts a React Native Android Blob without browser text or arrayBuffer methods', async () => {
    const payload = 'Türkçe UTF-8 ölçüm';
    await expect(readCloudBackupBlob(androidBlob(payload))).resolves.toBe(
      payload
    );
  });

  it.each([
    [
      'metadata row missing',
      () =>
        mockMetadataMaybeSingle.mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      'metadata_query',
      'metadata_not_found',
    ],
    [
      'metadata RLS failure',
      () =>
        mockMetadataMaybeSingle.mockResolvedValueOnce({
          data: null,
          error: { status: 403 },
        }),
      'metadata_query',
      'metadata_query_failed',
    ],
    [
      'metadata hash missing',
      () =>
        mockMetadataMaybeSingle.mockResolvedValueOnce({
          data: { byte_size: 100, content_hash: null },
          error: null,
        }),
      'metadata_validation',
      'metadata_invalid',
    ],
    [
      'metadata byte size missing',
      () =>
        mockMetadataMaybeSingle.mockResolvedValueOnce({
          data: { byte_size: null, content_hash: 'a'.repeat(64) },
          error: null,
        }),
      'metadata_validation',
      'metadata_invalid',
    ],
    [
      'Storage object missing',
      () =>
        mockDownload.mockResolvedValueOnce({
          data: null,
          error: { status: 404 },
        }),
      'storage_download',
      'storage_download_failed',
    ],
    [
      'Storage permission failure',
      () =>
        mockDownload.mockResolvedValueOnce({
          data: null,
          error: { status: 403 },
        }),
      'storage_download',
      'storage_download_failed',
    ],
    [
      'Storage network failure',
      () =>
        mockDownload.mockResolvedValueOnce({
          data: null,
          error: new Error('network'),
        }),
      'storage_download',
      'storage_download_failed',
    ],
  ])(
    'reports %s safely and leaves local data unchanged',
    async (_, arrange, stage, code) => {
      arrange();
      const db = database();
      await downloadCloudBackup(db).catch((error) =>
        expectDiagnostic(error, stage, code)
      );
      expect(db.runAsync).not.toHaveBeenCalled();
    }
  );

  it('distinguishes an Android Blob conversion failure', async () => {
    mockDownload.mockResolvedValueOnce({
      data: { size: serialized.length, type: 'application/json' } as Blob,
      error: null,
    });
    const read = jest
      .spyOn(AndroidFileReader.prototype, 'readAsText')
      .mockImplementationOnce(function (this: AndroidFileReader) {
        this.onerror?.();
      });
    const db = database();
    await downloadCloudBackup(db).catch((error) =>
      expectDiagnostic(error, 'blob_conversion', 'blob_conversion_failed')
    );
    expect(db.runAsync).not.toHaveBeenCalled();
    read.mockRestore();
  });

  it('accepts the exact UTF-8 byte size and matching hash', async () => {
    const unicode = serializeBackup({ ...backup, deviceId: 'ölçüm-device' });
    mockMetadataMaybeSingle.mockResolvedValueOnce({
      data: metadataFor(unicode),
      error: null,
    });
    mockDownload.mockResolvedValueOnce({
      data: androidBlob(unicode),
      error: null,
    });
    await expect(downloadCloudBackup(database())).resolves.toMatchObject({
      deviceId: 'ölçüm-device',
    });
  });

  it.each([
    ['size_validation', 'size_mismatch'],
    ['hash_validation', 'hash_mismatch'],
  ])('rejects a %s failure before archive parsing', async (stage, code) => {
    if (stage === 'size_validation') {
      mockMetadataMaybeSingle.mockResolvedValueOnce({
        data: { ...metadataFor(serialized), byte_size: 1 },
        error: null,
      });
    } else {
      mockMetadataMaybeSingle.mockResolvedValueOnce({
        data: { ...metadataFor(serialized), content_hash: 'b'.repeat(64) },
        error: null,
      });
    }
    const db = database();
    await downloadCloudBackup(db).catch((error) =>
      expectDiagnostic(error, stage, code)
    );
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed archive', '{', 'archive_parse', 'archive_parse_failed'],
    [
      'unsupported format',
      serializeBackup(backup).replace(
        '"formatVersion": 1',
        '"formatVersion": 2'
      ),
      'archive_validation',
      'archive_validation_failed',
    ],
    [
      'unsupported fitness schema',
      serializeBackup(backup).replace(
        '"schemaVersion": 5',
        '"schemaVersion": 5'
      ),
      'archive_validation',
      'archive_validation_failed',
    ],
  ])(
    'rejects %s after integrity validation',
    async (_, payload, stage, code) => {
      mockMetadataMaybeSingle.mockResolvedValueOnce({
        data: metadataFor(payload),
        error: null,
      });
      mockDownload.mockResolvedValueOnce({
        data: androidBlob(payload),
        error: null,
      });
      const db = database();
      await downloadCloudBackup(db).catch((error) =>
        expectDiagnostic(error, stage, code)
      );
      expect(db.runAsync).not.toHaveBeenCalled();
    }
  );

  it('rejects a missing relationship after size and hash pass', async () => {
    const orphan: TitanLogBackup = {
      ...backup,
      data: {
        ...backup.data,
        exercises: [
          {
            id: 1,
            name: 'Row',
            muscle_group: 'Back',
            equipment: 'Cable',
            created_at: backup.createdAt,
            updated_at: backup.createdAt,
          },
        ],
        workout_session_exercises: [
          {
            id: 1,
            session_id: 404,
            exercise_id: 1,
            exercise_name_snapshot: 'Row',
            muscle_group_snapshot: 'Back',
            weight_mode_snapshot: 'total',
            sort_order: 1,
            created_at: backup.createdAt,
          },
        ],
      },
      summary: { ...backup.summary, exercises: 1 },
    };
    const payload = JSON.stringify(orphan);
    mockMetadataMaybeSingle.mockResolvedValueOnce({
      data: metadataFor(payload),
      error: null,
    });
    mockDownload.mockResolvedValueOnce({
      data: androidBlob(payload),
      error: null,
    });
    await downloadCloudBackup(database()).catch((error) =>
      expectDiagnostic(error, 'archive_validation', 'archive_validation_failed')
    );
  });

  it('rejects non-canonical serialization even when integrity and archive validation pass', async () => {
    const payload = JSON.stringify(backup);
    mockMetadataMaybeSingle.mockResolvedValueOnce({
      data: metadataFor(payload),
      error: null,
    });
    mockDownload.mockResolvedValueOnce({
      data: androidBlob(payload),
      error: null,
    });
    await downloadCloudBackup(database()).catch((error) =>
      expectDiagnostic(
        error,
        'canonical_validation',
        'canonical_validation_failed'
      )
    );
  });

  it('logs only the typed development diagnostic without private values', async () => {
    mockDownload.mockResolvedValueOnce({ data: null, error: { status: 403 } });
    await expect(downloadCloudBackup(database())).rejects.toBeDefined();
    expect(consoleWarn).toHaveBeenCalledWith(
      'TitanLog manual cloud backup download failed',
      expect.objectContaining({
        code: 'storage_download_failed',
        httpStatusCategory: '4xx',
        stage: 'storage_download',
      })
    );
    const diagnostic = JSON.stringify(consoleWarn.mock.calls[0]);
    expect(diagnostic).not.toMatch(
      /access.token|refresh.token|authorization|example\.com|supabase\.co|latest\.titanlog|123e4567|[a-f0-9]{64}/i
    );
  });

  it('blocks unauthenticated and foreign-owner upload before Storage', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(uploadCloudBackup(database())).rejects.toMatchObject({
      code: 'not_authenticated',
    });
    await expect(
      uploadCloudBackup(database('other-account'))
    ).rejects.toMatchObject({
      code: 'owner_mismatch',
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('fails closed when object upload succeeds but metadata persistence fails', async () => {
    const db = database();
    mockMetadataUpsert.mockResolvedValueOnce({ error: new Error('metadata') });
    await expect(uploadCloudBackup(db)).rejects.toMatchObject({
      code: 'remote_failure',
    });
    expect(mockUpload).toHaveBeenCalledTimes(1);
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
