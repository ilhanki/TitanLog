import type { SQLiteDatabase } from 'expo-sqlite';

import type { TitanLogBackup } from '@/features/data-safety/backup-types';

const backup: TitanLogBackup = {
  appVersion: '0.1.0-alpha.10',
  createdAt: '2026-08-01T21:38:00.000Z',
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
  summary: {
    exercises: 0,
    measurements: 0,
    programs: 0,
    sets: 0,
    workouts: 0,
  },
};

const events: string[] = [];
const mockDelete = jest.fn(() => {
  events.push('delete');
  fileState.exists = false;
});
const mockCreate = jest.fn((_options?: unknown) => {
  events.push('create');
  fileState.exists = true;
});
const mockWrite = jest.fn((_content?: string) => {
  events.push('write');
});
const fileState = {
  deleteError: null as Error | null,
  exists: false,
  size: 100 as number | null,
  uri: 'file:///cache/titanlog-backup.titanlog',
};
let constructedWith: unknown[] = [];
let mockPickedText = JSON.stringify(backup);

jest.mock('expo-document-picker', () => ({
  __esModule: true,
  getDocumentAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class MockFile {
    constructor(...sources: unknown[]) {
      constructedWith = sources;
      if (typeof sources[0] === 'string') fileState.uri = sources[0];
    }
    get exists() {
      return fileState.exists;
    }
    get size() {
      return fileState.size;
    }
    get uri() {
      return fileState.uri;
    }
    create(options: unknown) {
      return mockCreate(options);
    }
    write(content: string) {
      return mockWrite(content);
    }
    delete() {
      if (fileState.deleteError) throw fileState.deleteError;
      return mockDelete();
    }
    async text() {
      return mockPickedText;
    }
  },
}));
jest.mock('@/features/data-safety/backup-repository', () => {
  class BackupArchiveError extends Error {
    constructor(readonly mockStage: string) {
      super(mockStage);
    }

    get stage() {
      return this.mockStage;
    }
  }
  return {
    BackupArchiveError,
    createBackupArchive: jest.fn(),
  };
});

import {
  BackupArchiveError,
  createBackupArchive,
} from '@/features/data-safety/backup-repository';
import {
  createBackupFileName,
  localBackupErrorMessage,
  LocalBackupExportError,
  pickLocalBackup,
  shareLocalBackup,
} from '@/features/data-safety/local-backup-service';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

const mockCreateBackup = createBackupArchive as jest.Mock;
const mockPicker = DocumentPicker.getDocumentAsync as jest.Mock;
const mockShare = Sharing.shareAsync as jest.Mock;
const mockIsSharingAvailable = Sharing.isAvailableAsync as jest.Mock;
const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
const database = { runAsync } as unknown as SQLiteDatabase;
let mockWarning: jest.SpyInstance;

describe('local backup file lifecycle', () => {
  beforeEach(() => {
    mockWarning = jest.spyOn(console, 'warn').mockImplementation();
    jest.clearAllMocks();
    events.length = 0;
    constructedWith = [];
    fileState.deleteError = null;
    fileState.exists = false;
    fileState.size = 100;
    fileState.uri = 'file:///cache/titanlog-backup.titanlog';
    mockPickedText = JSON.stringify(backup);
    mockCreateBackup.mockResolvedValue(backup);
    mockShare.mockImplementation(async () => {
      events.push('share');
    });
    mockIsSharingAvailable.mockImplementation(async () => {
      events.push('available');
      return true;
    });
  });
  afterEach(() => mockWarning.mockRestore());

  it('generates unique filesystem-safe names without personal data', () => {
    const first = createBackupFileName(backup.createdAt, 'a1b2');
    const second = createBackupFileName(backup.createdAt, 'c3d4');
    expect(first).toBe('titanlog-backup-20260801213800-a1b2.titanlog');
    expect(second).not.toBe(first);
    expect(first).not.toMatch(/[:\\/@]/);
    expect(first).not.toContain(backup.deviceId);
  });

  it('serializes before creating a cache file and shares only a verified file URI', async () => {
    await shareLocalBackup(database);
    expect(constructedWith[0]).toEqual({ uri: 'file:///cache/' });
    expect(constructedWith[1]).toMatch(
      /^titanlog-backup-\d{14}-[a-z0-9]{4}\.titanlog$/
    );
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining('"format": "titanlog-backup"')
    );
    expect(events).toEqual(['create', 'write', 'available', 'share', 'delete']);
    expect(mockShare).toHaveBeenCalledWith(
      'file:///cache/titanlog-backup.titanlog',
      expect.objectContaining({ mimeType: 'application/octet-stream' })
    );
  });

  it.each([
    ['missing', false, 100],
    ['empty', true, 0],
  ])('never shares a %s temporary file', async (_name, exists, size) => {
    fileState.exists = exists;
    fileState.size = size;
    mockCreate.mockImplementationOnce(() => events.push('create'));
    await expect(shareLocalBackup(database)).rejects.toMatchObject({
      stage: 'temporary_file_verify',
    });
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('checks sharing availability and reports an unavailable device safely', async () => {
    mockIsSharingAvailable.mockResolvedValue(false);
    await expect(shareLocalBackup(database)).rejects.toMatchObject({
      stage: 'sharing_unavailable',
    });
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('treats share-sheet dismissal as success and cleans up after settlement', async () => {
    let settleShare: (() => void) | undefined;
    mockShare.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          events.push('share');
          settleShare = resolve;
        })
    );
    const operation = shareLocalBackup(database);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockDelete).not.toHaveBeenCalled();
    settleShare?.();
    await expect(operation).resolves.toEqual(backup);
    expect(events.at(-1)).toBe('delete');
  });

  it('does not replace successful sharing with a cleanup failure', async () => {
    fileState.deleteError = Object.assign(new Error('private path'), {
      code: 'DELETE_FAILED',
    });
    await expect(shareLocalBackup(database)).resolves.toEqual(backup);
    expect(mockWarning).toHaveBeenCalledWith(
      'TitanLog local backup cleanup failed',
      expect.not.objectContaining({ path: expect.anything() })
    );
    expect(JSON.stringify(mockWarning.mock.calls)).not.toContain(
      'private path'
    );
  });

  it('does not replace successful sharing with a metadata update failure', async () => {
    runAsync.mockRejectedValueOnce(
      Object.assign(new Error('private metadata detail'), {
        code: 'SQLITE_BUSY',
      })
    );
    await expect(shareLocalBackup(database)).resolves.toEqual(backup);
    expect(mockWarning).toHaveBeenCalledWith(
      'TitanLog local backup metadata update failed',
      expect.objectContaining({ nativeErrorCode: 'SQLITE_BUSY' })
    );
    expect(JSON.stringify(mockWarning.mock.calls)).not.toContain(
      'private metadata detail'
    );
  });

  it.each([
    [
      'snapshot_read',
      () =>
        mockCreateBackup.mockRejectedValue(
          new BackupArchiveError('snapshot_read')
        ),
    ],
    [
      'archive_validation',
      () =>
        mockCreateBackup.mockRejectedValue(
          new BackupArchiveError('archive_validation')
        ),
    ],
    [
      'serialization',
      () =>
        mockCreateBackup.mockResolvedValue({ ...backup, format: 'invalid' }),
    ],
    [
      'temporary_file_create',
      () =>
        mockCreate.mockImplementationOnce(() => {
          throw new Error('create');
        }),
    ],
    [
      'temporary_file_write',
      () =>
        mockWrite.mockImplementationOnce(() => {
          throw new Error('write');
        }),
    ],
    ['temporary_file_verify', () => (fileState.size = 0)],
    [
      'sharing_unavailable',
      () => mockIsSharingAvailable.mockResolvedValue(false),
    ],
    ['sharing', () => mockShare.mockRejectedValue(new Error('share'))],
  ])(
    'preserves SQLite data after %s failure and releases the operation lock',
    async (stage, arrange) => {
      arrange();
      await expect(shareLocalBackup(database)).rejects.toMatchObject({ stage });
      expect(runAsync).not.toHaveBeenCalled();
      mockCreateBackup.mockResolvedValue(backup);
      fileState.size = 100;
      mockIsSharingAvailable.mockResolvedValue(true);
      mockShare.mockImplementation(async () => {
        events.push('share');
      });
      await expect(shareLocalBackup(database)).resolves.toEqual(backup);
    }
  );

  it('coalesces rapid repeated exports into one operation', async () => {
    let settleShare: (() => void) | undefined;
    mockShare.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          settleShare = resolve;
        })
    );
    const first = shareLocalBackup(database);
    const second = shareLocalBackup(database);
    expect(second).toBe(first);
    await new Promise(setImmediate);
    settleShare?.();
    await first;
    expect(mockCreateBackup).toHaveBeenCalledTimes(1);
    expect(mockShare).toHaveBeenCalledTimes(1);
  });

  it('keeps diagnostics free of archive and personal content', async () => {
    mockShare.mockRejectedValue(
      Object.assign(new Error('contains private data'), {
        code: 'SHARE_FAILED',
      })
    );
    await expect(shareLocalBackup(database)).rejects.toBeInstanceOf(
      LocalBackupExportError
    );
    const logged = JSON.stringify(mockWarning.mock.calls);
    expect(logged).toContain('SHARE_FAILED');
    expect(logged).not.toContain(backup.deviceId);
    expect(logged).not.toContain('contains private data');
    expect(logged).not.toContain('access_token');
  });

  it('maps internal failures to specific safe Turkish messages', () => {
    expect(
      localBackupErrorMessage(
        new LocalBackupExportError('sharing', {
          platform: 'android',
          stage: 'sharing',
        })
      )
    ).toBe(
      'Android paylaşım ekranı açılamadı. Yerel verilerin değişmeden korundu.'
    );
    expect(
      localBackupErrorMessage(
        new LocalBackupExportError('sharing_unavailable', {
          platform: 'android',
          stage: 'sharing_unavailable',
        })
      )
    ).toContain('dosya paylaşımı kullanılamıyor');
    expect(
      localBackupErrorMessage(
        new LocalBackupExportError('temporary_file_write', {
          platform: 'android',
          stage: 'temporary_file_write',
        })
      )
    ).toContain('Geçici yedek dosyası oluşturulamadı');
  });

  it('treats picker cancellation as a no-op', async () => {
    mockPicker.mockResolvedValue({ canceled: true });
    await expect(pickLocalBackup()).resolves.toBeNull();
  });

  it('validates a selected .titanlog archive without deleting it', async () => {
    mockPicker.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'backup.titanlog', uri: 'picked://backup' }],
    });
    await expect(pickLocalBackup()).resolves.toMatchObject({
      format: 'titanlog-backup',
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
