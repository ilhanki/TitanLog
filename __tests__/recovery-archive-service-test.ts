import type { SQLiteDatabase } from 'expo-sqlite';

const mockDirectoryCreate = jest.fn();
const mockFileCreate = jest.fn();
const mockCreateBackupArchive = jest.fn();
let mockFileContent = '';
let mockFileExists = false;

jest.mock('expo-file-system', () => ({
  __esModule: true,
  Directory: class Directory {
    constructor(..._parts: unknown[]) {}
    create = mockDirectoryCreate;
  },
  File: class File {
    uri = 'file:///private/titanlog-recovery/pre-sync-recovery.titanlog';
    constructor(..._parts: unknown[]) {}
    create(options?: unknown) {
      mockFileCreate(options);
      mockFileExists = true;
      mockFileContent = '';
    }
    get exists() {
      return mockFileExists;
    }
    get size() {
      return new TextEncoder().encode(mockFileContent).byteLength;
    }
    async text() {
      return mockFileContent;
    }
    write(content: string) {
      mockFileContent = content;
    }
  },
  Paths: { document: 'file:///private' },
}));
jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('@/features/data-safety/backup-repository', () => ({
  createBackupArchive: (...args: unknown[]) => mockCreateBackupArchive(...args),
}));

import {
  createRecoveryArchive,
  hasRecoveryArchive,
  readRecoveryArchive,
  shareRecoveryArchive,
} from '@/features/sync/recovery-archive-service';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';
import * as Sharing from 'expo-sharing';

const mockIsAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;

function archive(createdAt: string): TitanLogBackup {
  return {
    appVersion: '0.1.0-alpha.10',
    createdAt,
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
    summary: {
      exercises: 0,
      measurements: 0,
      programs: 0,
      sets: 0,
      workouts: 0,
    },
  };
}

describe('pre-sync recovery archive lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileContent = '';
    mockFileExists = false;
    mockIsAvailableAsync.mockResolvedValue(true);
  });

  it('writes, verifies, and retains only the latest app-private archive', async () => {
    mockCreateBackupArchive
      .mockResolvedValueOnce(archive('2026-08-01T10:00:00.000Z'))
      .mockResolvedValueOnce(archive('2026-08-01T11:00:00.000Z'));
    const database = {} as SQLiteDatabase;

    await createRecoveryArchive(database);
    await createRecoveryArchive(database);

    expect(mockDirectoryCreate).toHaveBeenCalledWith({
      idempotent: true,
      intermediates: true,
    });
    expect(mockFileCreate).toHaveBeenNthCalledWith(1, { overwrite: true });
    expect(mockFileCreate).toHaveBeenNthCalledWith(2, { overwrite: true });
    expect(hasRecoveryArchive()).toBe(true);
    await expect(readRecoveryArchive()).resolves.toMatchObject({
      createdAt: '2026-08-01T11:00:00.000Z',
    });
    expect(mockFileContent).not.toMatch(/access_token|refresh_token|password/i);
  });

  it('exports only the verified private recovery file on explicit action', async () => {
    mockCreateBackupArchive.mockResolvedValue(
      archive('2026-08-01T10:00:00.000Z')
    );
    await createRecoveryArchive({} as SQLiteDatabase);
    await shareRecoveryArchive();
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///private/titanlog-recovery/pre-sync-recovery.titanlog',
      expect.objectContaining({
        dialogTitle: 'TitanLog Eşitleme Kurtarma Kopyası',
      })
    );
  });

  it('never reports a recovery archive before one exists', () => {
    expect(hasRecoveryArchive()).toBe(false);
  });
});
