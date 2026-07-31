import type { SQLiteDatabase } from 'expo-sqlite';

import type { TitanLogBackup } from '@/features/data-safety/backup-types';

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
const mockDelete = jest.fn();
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
  Paths: { cache: 'cache' },
  File: class MockFile {
    exists = true;
    size = 100;
    uri = 'cache/titanlog.titanlog';
    constructor(source: string) {
      if (typeof source === 'string' && source.startsWith('picked'))
        this.uri = source;
    }
    create() {}
    write() {}
    delete() {
      mockDelete();
      this.exists = false;
    }
    async text() {
      return mockPickedText;
    }
  },
}));
jest.mock('@/features/data-safety/backup-repository', () => ({
  createBackupArchive: jest.fn().mockResolvedValue(backup),
}));

import {
  pickLocalBackup,
  shareLocalBackup,
} from '@/features/data-safety/local-backup-service';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

const mockPicker = DocumentPicker.getDocumentAsync as jest.Mock;
const mockShare = Sharing.shareAsync as jest.Mock;
const mockIsSharingAvailable = Sharing.isAvailableAsync as jest.Mock;

const database = {
  runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
} as unknown as SQLiteDatabase;

describe('local backup file lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPickedText = JSON.stringify(backup);
    mockShare.mockResolvedValue(undefined);
    mockIsSharingAvailable.mockResolvedValue(true);
  });

  it('deletes only the TitanLog temporary file after sharing', async () => {
    await shareLocalBackup(database);
    expect(mockShare).toHaveBeenCalledWith(
      expect.stringContaining('.titanlog'),
      expect.any(Object)
    );
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('treats picker cancellation as a no-op', async () => {
    mockPicker.mockResolvedValue({ canceled: true });
    await expect(pickLocalBackup()).resolves.toBeNull();
  });

  it('validates a selected .titanlog archive', async () => {
    mockPicker.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'backup.titanlog', uri: 'picked://backup' }],
    });
    await expect(pickLocalBackup()).resolves.toMatchObject({
      format: 'titanlog-backup',
    });
  });
});
