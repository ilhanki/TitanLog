import type { SQLiteDatabase } from 'expo-sqlite';

const mockCreateHashedSyncArchive = jest.fn();
const mockCreateRecoveryArchive = jest.fn();
const mockDownloadRemoteSyncArchive = jest.fn();
const mockFetchRemoteSyncHead = jest.fn();
const mockPushRemoteSyncArchive = jest.fn();
const mockReplaceBackupData = jest.fn();
const mockGetOwnership = jest.fn();
const mockAssertCloudAccess = jest.fn();
const mockGetState = jest.fn();
const mockMarkPending = jest.fn();
const mockRecordResult = jest.fn();
const mockRecordSuccess = jest.fn();

jest.mock('expo-crypto', () => ({
  randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
}));
jest.mock('@/features/data-safety/backup-repository', () => ({
  replaceBackupData: (...args: unknown[]) => mockReplaceBackupData(...args),
}));
jest.mock('@/features/data-safety/dataset-ownership-repository', () => ({
  createDatasetOwnershipRepository: () => ({
    assertCloudAccess: mockAssertCloudAccess,
    getOwnership: mockGetOwnership,
  }),
}));
jest.mock('@/features/sync/canonical-sync-archive', () => ({
  createHashedSyncArchive: (...args: unknown[]) =>
    mockCreateHashedSyncArchive(...args),
}));
jest.mock('@/features/sync/recovery-archive-service', () => ({
  createRecoveryArchive: (...args: unknown[]) =>
    mockCreateRecoveryArchive(...args),
  hasRecoveryArchive: jest.fn(() => false),
}));
jest.mock('@/features/sync/remote-sync-client', () => {
  class RemoteSyncError extends Error {
    readonly code: string;
    constructor(mockErrorCode: string) {
      super(mockErrorCode);
      this.code = mockErrorCode;
    }
  }
  return {
    RemoteSyncError,
    downloadRemoteSyncArchive: (...args: unknown[]) =>
      mockDownloadRemoteSyncArchive(...args),
    fetchRemoteSyncHead: (...args: unknown[]) =>
      mockFetchRemoteSyncHead(...args),
    pushRemoteSyncArchive: (...args: unknown[]) =>
      mockPushRemoteSyncArchive(...args),
  };
});
jest.mock('@/features/sync/sync-state-repository', () => ({
  createSyncStateRepository: () => ({
    getState: mockGetState,
    markPending: mockMarkPending,
    recordResult: mockRecordResult,
    recordSuccess: mockRecordSuccess,
  }),
}));

import {
  cancelManualSync,
  inspectManualSync,
  pullManualSync,
  pushManualSync,
} from '@/features/sync/manual-sync-service';
import { RemoteSyncError } from '@/features/sync/remote-sync-client';
import type {
  HashedSyncArchive,
  RemoteSyncHead,
  SyncCheck,
  SyncState,
} from '@/features/sync/sync-types';

const accountId = '123e4567-e89b-12d3-a456-426614174000';
const local: HashedSyncArchive = {
  archive: {
    appVersion: 'sync-canonical-v1',
    createdAt: '1970-01-01T00:00:00.000Z',
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
    deviceId: 'titanlog-sync',
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
  },
  byteSize: 800,
  contentHash: 'a'.repeat(64),
  serialized: '{}',
};
const state: SyncState = {
  lastLocalContentHash: 'a'.repeat(64),
  lastRemoteContentHash: 'a'.repeat(64),
  lastRemoteRevision: 2,
  lastResultCode: 'completed',
  lastSuccessfulSyncAt: '2026-08-01T10:00:00.000Z',
  pendingOperationId: null,
};
const head: RemoteSyncHead = {
  archiveFormatVersion: 1,
  archiveSchemaVersion: 4,
  byteSize: 800,
  contentHash: 'a'.repeat(64),
  revision: 2,
  summary: local.archive.summary,
  updatedAt: '2026-08-01T10:00:00.000Z',
};

function database() {
  const transaction = {} as SQLiteDatabase;
  return {
    transaction,
    value: {
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase,
  };
}

function check(overrides: Partial<SyncCheck> = {}): SyncCheck {
  return {
    hasLocalChanges: true,
    hasRemoteChanges: false,
    local,
    phase: 'local_changed',
    remoteHead: head,
    state,
    ...overrides,
  };
}

describe('manual sync service safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOwnership.mockResolvedValue({ ownerAccountId: accountId });
    mockAssertCloudAccess.mockResolvedValue(undefined);
    mockCreateHashedSyncArchive.mockResolvedValue(local);
    mockGetState.mockResolvedValue(state);
    mockFetchRemoteSyncHead.mockResolvedValue(head);
    mockPushRemoteSyncArchive.mockResolvedValue({
      contentHash: local.contentHash,
      revision: 3,
    });
    mockDownloadRemoteSyncArchive.mockResolvedValue(local.archive);
    mockCreateRecoveryArchive.mockResolvedValue(local.archive);
    mockReplaceBackupData.mockResolvedValue(undefined);
    mockMarkPending.mockResolvedValue(undefined);
    mockRecordResult.mockResolvedValue(undefined);
    mockRecordSuccess.mockResolvedValue(undefined);
  });

  it('keeps guest, unowned, and mismatched datasets away from the network', async () => {
    const guestDb = database().value;
    await expect(inspectManualSync(guestDb, null)).resolves.toMatchObject({
      phase: 'signed_out',
    });
    mockGetOwnership.mockResolvedValueOnce({ ownerAccountId: null });
    await expect(
      inspectManualSync(database().value, accountId)
    ).resolves.toMatchObject({ phase: 'dataset_unowned' });
    mockGetOwnership.mockResolvedValueOnce({ ownerAccountId: 'other-account' });
    await expect(
      inspectManualSync(database().value, accountId)
    ).resolves.toMatchObject({ phase: 'account_mismatch' });
    expect(mockFetchRemoteSyncHead).not.toHaveBeenCalled();
  });

  it.each([
    ['offline', 'offline'],
    ['authentication_failure', 'authentication_failure'],
    ['recoverable_server_failure', 'recoverable_server_failure'],
  ])('maps %s without changing local data', async (code, phase) => {
    mockFetchRemoteSyncHead.mockRejectedValueOnce(
      new RemoteSyncError(code as never)
    );
    const db = database();
    await expect(inspectManualSync(db.value, accountId)).resolves.toMatchObject(
      { phase }
    );
    expect(db.value.withExclusiveTransactionAsync).not.toHaveBeenCalled();
    expect(mockRecordResult).toHaveBeenCalledWith(phase, expect.any(String));
  });

  it('deduplicates rapid repeated sync checks', async () => {
    let resolveHead!: (value: RemoteSyncHead) => void;
    const pendingHead = new Promise<RemoteSyncHead>((resolve) => {
      resolveHead = resolve;
    });
    mockFetchRemoteSyncHead.mockReturnValueOnce(pendingHead);
    const db = database().value;
    const first = inspectManualSync(db, accountId);
    const second = inspectManualSync(db, accountId);
    expect(second).toBe(first);
    resolveHead(head);
    await first;
    expect(mockFetchRemoteSyncHead).toHaveBeenCalledTimes(1);
  });

  it('marks an operation and records an accepted immutable revision', async () => {
    const result = await pushManualSync(database().value, check(), accountId);
    expect(mockAssertCloudAccess).toHaveBeenCalledWith(accountId);
    expect(mockMarkPending).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
      expect.any(String)
    );
    expect(mockPushRemoteSyncArchive).toHaveBeenCalledWith(
      local,
      2,
      '123e4567-e89b-12d3-a456-426614174000'
    );
    expect(result).toMatchObject({ phase: 'completed' });
    expect(mockRecordSuccess).toHaveBeenCalledWith(
      3,
      local.contentHash,
      local.contentHash,
      expect.any(String)
    );
  });

  it('turns a stale push into a freshly fetched conflict without retrying', async () => {
    mockPushRemoteSyncArchive.mockRejectedValueOnce(
      new RemoteSyncError('stale_revision')
    );
    mockFetchRemoteSyncHead.mockResolvedValueOnce({ ...head, revision: 4 });
    const result = await pushManualSync(database().value, check(), accountId);
    expect(result).toMatchObject({ phase: 'conflict' });
    expect(mockPushRemoteSyncArchive).toHaveBeenCalledTimes(1);
    expect(mockFetchRemoteSyncHead).toHaveBeenCalledTimes(1);
  });

  it('creates recovery first and replaces data with sync state in one transaction', async () => {
    const db = database();
    const result = await pullManualSync(
      db.value,
      check({ phase: 'cloud_changed' }),
      accountId
    );
    expect(result).toMatchObject({ phase: 'completed' });
    expect(mockCreateRecoveryArchive).toHaveBeenCalledWith(db.value);
    expect(db.value.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockReplaceBackupData).toHaveBeenCalledWith(
      db.transaction,
      local.archive
    );
    expect(mockRecordSuccess).toHaveBeenCalledWith(
      head.revision,
      head.contentHash,
      head.contentHash,
      expect.any(String)
    );
    expect(mockCreateRecoveryArchive.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplaceBackupData.mock.invocationCallOrder[0]!
    );
  });

  it('does not begin local replacement after download validation failure', async () => {
    mockDownloadRemoteSyncArchive.mockRejectedValueOnce(
      new RemoteSyncError('validation_failure')
    );
    const db = database();
    await expect(
      pullManualSync(db.value, check({ phase: 'cloud_changed' }), accountId)
    ).resolves.toMatchObject({ phase: 'validation_failure' });
    expect(mockCreateRecoveryArchive).not.toHaveBeenCalled();
    expect(db.value.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('records cancellation without changing the accepted base', async () => {
    await cancelManualSync(database().value);
    expect(mockRecordResult).toHaveBeenCalledWith(
      'cancelled',
      expect.any(String)
    );
    expect(mockRecordSuccess).not.toHaveBeenCalled();
  });
});
