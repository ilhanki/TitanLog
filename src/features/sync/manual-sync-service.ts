import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { replaceBackupData } from '@/features/data-safety/backup-repository';
import { createDatasetOwnershipRepository } from '@/features/data-safety/dataset-ownership-repository';
import { createHashedSyncArchive } from '@/features/sync/canonical-sync-archive';
import {
  createRecoveryArchive,
  hasRecoveryArchive,
} from '@/features/sync/recovery-archive-service';
import {
  downloadRemoteSyncArchive,
  fetchRemoteSyncHead,
  pushRemoteSyncArchive,
  RemoteSyncError,
} from '@/features/sync/remote-sync-client';
import { decideManualSync } from '@/features/sync/sync-state-machine';
import { createSyncStateRepository } from '@/features/sync/sync-state-repository';
import type {
  ManualSyncPhase,
  RemoteSyncHead,
  SyncCheck,
  SyncResultCode,
} from '@/features/sync/sync-types';

const activeOperations = new WeakMap<SQLiteDatabase, Promise<SyncCheck>>();

function emptyCheck(phase: ManualSyncPhase): SyncCheck {
  return {
    hasLocalChanges: false,
    hasRemoteChanges: false,
    local: null,
    phase,
    remoteHead: null,
    state: null,
  };
}

function runOnce(
  database: SQLiteDatabase,
  operation: () => Promise<SyncCheck>
): Promise<SyncCheck> {
  const active = activeOperations.get(database);
  if (active) return active;
  const promise = operation();
  activeOperations.set(database, promise);
  const release = () => {
    if (activeOperations.get(database) === promise)
      activeOperations.delete(database);
  };
  void promise.then(release, release);
  return promise;
}

function resultCodeForError(error: unknown): SyncResultCode {
  if (error instanceof RemoteSyncError) {
    if (error.code === 'offline') return 'offline';
    if (error.code === 'authentication_failure')
      return 'authentication_failure';
    if (error.code === 'unsupported_remote_version')
      return 'unsupported_remote_version';
    if (error.code === 'validation_failure') return 'validation_failure';
    if (error.code === 'stale_revision') return 'conflict';
  }
  return 'recoverable_server_failure';
}

function phaseForResult(code: SyncResultCode): ManualSyncPhase {
  if (code === 'cancelled') return 'ready';
  if (code === 'completed') return 'completed';
  if (code === 'conflict') return 'conflict';
  return code;
}

async function safeRecordResult(
  database: SQLiteDatabase,
  code: SyncResultCode
): Promise<void> {
  await createSyncStateRepository(database)
    .recordResult(code, new Date().toISOString())
    .catch(() => {});
}

export function inspectManualSync(
  database: SQLiteDatabase,
  accountId: string | null
): Promise<SyncCheck> {
  return runOnce(database, async () => {
    if (!accountId) return emptyCheck('signed_out');
    try {
      const ownership =
        await createDatasetOwnershipRepository(database).getOwnership();
      if (!ownership.ownerAccountId) return emptyCheck('dataset_unowned');
      if (ownership.ownerAccountId !== accountId)
        return emptyCheck('account_mismatch');
      const [local, state] = await Promise.all([
        createHashedSyncArchive(database),
        createSyncStateRepository(database).getState(),
      ]);
      const remoteHead = await fetchRemoteSyncHead();
      const decision = decideManualSync(local.contentHash, state, remoteHead);
      if (decision.phase === 'unchanged' && remoteHead) {
        await createSyncStateRepository(database).recordSuccess(
          remoteHead.revision,
          remoteHead.contentHash,
          local.contentHash,
          new Date().toISOString()
        );
      }
      return { ...decision, local, remoteHead, state };
    } catch (error) {
      const code = resultCodeForError(error);
      await safeRecordResult(database, code);
      return emptyCheck(phaseForResult(code));
    }
  });
}

function acceptedHead(
  check: SyncCheck,
  revision: number,
  contentHash: string,
  at: string
): RemoteSyncHead {
  if (!check.local) throw new Error('local_archive_missing');
  return {
    archiveFormatVersion: check.local.archive.formatVersion,
    archiveSchemaVersion: check.local.archive.schemaVersion,
    byteSize: check.local.byteSize,
    contentHash,
    revision,
    summary: check.local.archive.summary,
    updatedAt: at,
  };
}

export function pushManualSync(
  database: SQLiteDatabase,
  check: SyncCheck,
  accountId: string | null
): Promise<SyncCheck> {
  return runOnce(database, async () => {
    if (
      !check.local ||
      !['cloud_empty', 'local_changed', 'conflict'].includes(check.phase)
    )
      return check;
    if (!accountId) return { ...check, phase: 'authentication_failure' };
    await createDatasetOwnershipRepository(database).assertCloudAccess(
      accountId
    );
    const operationId = randomUUID();
    const startedAt = new Date().toISOString();
    await createSyncStateRepository(database).markPending(
      operationId,
      startedAt
    );
    try {
      const accepted = await pushRemoteSyncArchive(
        check.local,
        check.remoteHead?.revision ?? 0,
        operationId
      );
      const completedAt = new Date().toISOString();
      await createSyncStateRepository(database).recordSuccess(
        accepted.revision,
        accepted.contentHash,
        check.local.contentHash,
        completedAt
      );
      return {
        ...check,
        hasLocalChanges: false,
        hasRemoteChanges: false,
        phase: 'completed',
        remoteHead: acceptedHead(
          check,
          accepted.revision,
          accepted.contentHash,
          completedAt
        ),
      };
    } catch (error) {
      const code = resultCodeForError(error);
      await safeRecordResult(database, code);
      if (code === 'conflict') {
        const remoteHead = await fetchRemoteSyncHead().catch(() => null);
        return {
          ...check,
          hasLocalChanges: true,
          hasRemoteChanges: true,
          phase: 'conflict',
          remoteHead,
        };
      }
      return { ...check, phase: phaseForResult(code) };
    }
  });
}

export function pullManualSync(
  database: SQLiteDatabase,
  check: SyncCheck,
  accountId: string | null
): Promise<SyncCheck> {
  return runOnce(database, async () => {
    if (
      !check.remoteHead ||
      !['cloud_changed', 'conflict'].includes(check.phase)
    )
      return check;
    if (!accountId) return { ...check, phase: 'authentication_failure' };
    await createDatasetOwnershipRepository(database).assertCloudAccess(
      accountId
    );
    try {
      const archive = await downloadRemoteSyncArchive(check.remoteHead);
      await createRecoveryArchive(database);
      const completedAt = new Date().toISOString();
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await replaceBackupData(transaction, archive);
        await createSyncStateRepository(transaction).recordSuccess(
          check.remoteHead!.revision,
          check.remoteHead!.contentHash,
          check.remoteHead!.contentHash,
          completedAt
        );
      });
      return {
        ...check,
        hasLocalChanges: false,
        hasRemoteChanges: false,
        phase: 'completed',
        state: await createSyncStateRepository(database).getState(),
      };
    } catch (error) {
      const code = resultCodeForError(error);
      await safeRecordResult(database, code);
      return {
        ...check,
        phase: phaseForResult(code),
      };
    }
  });
}

export async function cancelManualSync(
  database: SQLiteDatabase
): Promise<void> {
  await createSyncStateRepository(database).recordResult(
    'cancelled',
    new Date().toISOString()
  );
}

export { hasRecoveryArchive };
