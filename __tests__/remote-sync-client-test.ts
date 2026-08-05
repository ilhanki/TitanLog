const mockGetUser = jest.fn();
const mockInvoke = jest.fn();
const mockHashCanonicalArchive = jest.fn();

jest.mock('expo/fetch', () => ({ __esModule: true, fetch: jest.fn() }));
jest.mock('expo-network', () => ({
  __esModule: true,
  getNetworkStateAsync: jest.fn(),
}));
jest.mock('@/features/auth/supabase-client', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: mockGetUser },
    functions: { invoke: mockInvoke },
  }),
}));
jest.mock('@/features/sync/canonical-sync-archive', () => ({
  hashCanonicalArchive: (...args: unknown[]) =>
    mockHashCanonicalArchive(...args),
}));

import { serializeBackup } from '@/features/data-safety/backup-serialization';
import * as ExpoFetch from 'expo/fetch';
import * as Network from 'expo-network';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';
import {
  downloadRemoteSyncArchive,
  fetchRemoteSyncHead,
  pushRemoteSyncArchive,
} from '@/features/sync/remote-sync-client';
import type {
  HashedSyncArchive,
  RemoteSyncHead,
} from '@/features/sync/sync-types';

const mockFetch = ExpoFetch.fetch as jest.Mock;
const mockGetNetworkStateAsync = Network.getNetworkStateAsync as jest.Mock;

const archive: TitanLogBackup = {
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
  schemaVersion: 5,
  summary: { exercises: 0, measurements: 0, programs: 0, sets: 0, workouts: 0 },
};
const serialized = serializeBackup(archive);
const contentHash = 'a'.repeat(64);
const head: RemoteSyncHead = {
  archiveFormatVersion: 1,
  archiveSchemaVersion: 5,
  byteSize: new TextEncoder().encode(serialized).byteLength,
  contentHash,
  revision: 2,
  summary: archive.summary,
  updatedAt: '2026-08-01T10:00:00.000Z',
};
const local: HashedSyncArchive = {
  archive,
  byteSize: head.byteSize,
  contentHash,
  serialized,
};

describe('remote sync client boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'authenticated-user' } },
      error: null,
    });
    mockHashCanonicalArchive.mockResolvedValue(contentHash);
  });

  it('returns offline without invoking a remote function', async () => {
    mockGetNetworkStateAsync.mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
    });
    await expect(fetchRemoteSyncHead()).rejects.toMatchObject({
      code: 'offline',
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('handles explicit empty cloud and validates private head metadata', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { empty: true }, error: null });
    await expect(fetchRemoteSyncHead()).resolves.toBeNull();

    mockInvoke.mockResolvedValueOnce({
      data: { empty: false, head },
      error: null,
    });
    await expect(fetchRemoteSyncHead()).resolves.toEqual(head);
  });

  it('pushes only canonical bytes, CAS revision, hash, and operation ID', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { contentHash, revision: 3 },
      error: null,
    });
    await expect(
      pushRemoteSyncArchive(local, 2, '123e4567-e89b-12d3-a456-426614174000')
    ).resolves.toEqual({ contentHash, revision: 3 });
    expect(mockInvoke).toHaveBeenCalledWith('sync-push', {
      body: {
        archive: serialized,
        contentHash,
        expectedRevision: 2,
        operationId: '123e4567-e89b-12d3-a456-426614174000',
      },
    });
    expect(JSON.stringify(mockInvoke.mock.calls[0])).not.toMatch(
      /userId|email|service.role/i
    );
  });

  it('maps a stale CAS response to a typed conflict', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { context: { status: 409 } },
    });
    await expect(
      pushRemoteSyncArchive(local, 2, '123e4567-e89b-12d3-a456-426614174000')
    ).rejects.toMatchObject({ code: 'stale_revision' });
  });

  it('downloads through a short-lived private URL and verifies size, hash, and archive', async () => {
    const privateUrl =
      'https://project.supabase.co/storage/v1/object/sign/private-token';
    mockInvoke.mockResolvedValueOnce({
      data: { downloadUrl: privateUrl, empty: false, head },
      error: null,
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValue(serialized),
    });

    await expect(downloadRemoteSyncArchive(head)).resolves.toEqual(archive);
    expect(mockFetch).toHaveBeenCalledWith(privateUrl);
    expect(mockHashCanonicalArchive).toHaveBeenCalledWith(serialized);
  });

  it.each([
    ['size', { ...head, byteSize: head.byteSize + 1 }, contentHash],
    ['hash', head, 'b'.repeat(64)],
  ])(
    'rejects %s mismatches without returning archive data',
    async (_case, nextHead, hash) => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          downloadUrl:
            'https://project.supabase.co/storage/v1/object/sign/token',
          empty: false,
          head: nextHead,
        },
        error: null,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(serialized),
      });
      mockHashCanonicalArchive.mockReset().mockResolvedValue(hash);
      await expect(downloadRemoteSyncArchive(nextHead)).rejects.toMatchObject({
        code: 'validation_failure',
      });
    }
  );

  it('rejects a head that changes during confirmation before download', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        downloadUrl: 'https://project.supabase.co/storage/v1/object/sign/token',
        empty: false,
        head: { ...head, revision: 3 },
      },
      error: null,
    });
    await expect(downloadRemoteSyncArchive(head)).rejects.toMatchObject({
      code: 'stale_revision',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('blocks unsupported remote schema before download', async () => {
    const unsupported = { ...head, archiveSchemaVersion: 6 };
    mockInvoke.mockResolvedValueOnce({
      data: {
        downloadUrl: 'https://project.supabase.co/storage/v1/object/sign/token',
        empty: false,
        head: unsupported,
      },
      error: null,
    });
    await expect(downloadRemoteSyncArchive(unsupported)).rejects.toMatchObject({
      code: 'unsupported_remote_version',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
