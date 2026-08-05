import { decideManualSync } from '@/features/sync/sync-state-machine';
import type { RemoteSyncHead, SyncState } from '@/features/sync/sync-types';

const base: SyncState = {
  lastLocalContentHash: 'a'.repeat(64),
  lastRemoteContentHash: 'a'.repeat(64),
  lastRemoteRevision: 3,
  lastResultCode: 'completed',
  lastSuccessfulSyncAt: '2026-08-01T10:00:00.000Z',
  pendingOperationId: null,
};

function head(overrides: Partial<RemoteSyncHead> = {}): RemoteSyncHead {
  return {
    archiveFormatVersion: 1,
    archiveSchemaVersion: 5,
    byteSize: 1024,
    contentHash: 'a'.repeat(64),
    revision: 3,
    summary: {
      exercises: 4,
      measurements: 5,
      programs: 1,
      sets: 40,
      workouts: 6,
    },
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('manual sync decision matrix', () => {
  it('selects cloud-empty and unchanged branches', () => {
    expect(decideManualSync('a'.repeat(64), base, null)).toMatchObject({
      phase: 'cloud_empty',
    });
    expect(decideManualSync('a'.repeat(64), base, head())).toMatchObject({
      hasLocalChanges: false,
      hasRemoteChanges: false,
      phase: 'unchanged',
    });
  });

  it('distinguishes local-only, remote-only, and simultaneous changes', () => {
    expect(decideManualSync('b'.repeat(64), base, head())).toMatchObject({
      hasLocalChanges: true,
      hasRemoteChanges: false,
      phase: 'local_changed',
    });
    expect(
      decideManualSync(
        'a'.repeat(64),
        base,
        head({ contentHash: 'c'.repeat(64), revision: 4 })
      )
    ).toMatchObject({
      hasLocalChanges: false,
      hasRemoteChanges: true,
      phase: 'cloud_changed',
    });
    expect(
      decideManualSync(
        'b'.repeat(64),
        base,
        head({ contentHash: 'c'.repeat(64), revision: 4 })
      )
    ).toMatchObject({
      hasLocalChanges: true,
      hasRemoteChanges: true,
      phase: 'conflict',
    });
  });

  it('never guesses a winner when a different remote dataset has no base', () => {
    expect(
      decideManualSync(
        'b'.repeat(64),
        {
          ...base,
          lastLocalContentHash: null,
          lastRemoteContentHash: null,
          lastRemoteRevision: null,
        },
        head({ contentHash: 'c'.repeat(64), revision: 1 })
      )
    ).toMatchObject({ phase: 'conflict' });
  });

  it.each([
    ['format', { archiveFormatVersion: 2 }],
    ['schema', { archiveSchemaVersion: 6 }],
  ])('blocks unsupported remote %s versions', (_label, override) => {
    expect(
      decideManualSync('a'.repeat(64), base, head(override))
    ).toMatchObject({ phase: 'unsupported_remote_version' });
  });
});
