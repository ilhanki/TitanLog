import type { SQLiteDatabase } from 'expo-sqlite';

import type { SyncResultCode, SyncState } from '@/features/sync/sync-types';

type SyncStateRow = {
  last_local_content_hash: string | null;
  last_remote_content_hash: string | null;
  last_remote_revision: number | null;
  last_result_code: SyncResultCode | null;
  last_successful_sync_at: string | null;
  pending_operation_id: string | null;
};

export class SyncStateError extends Error {
  constructor(readonly code: 'state_missing' | 'state_write_failed') {
    super(code);
    this.name = 'SyncStateError';
  }
}

export function syncStateFromRow(row: SyncStateRow): SyncState {
  return {
    lastLocalContentHash: row.last_local_content_hash,
    lastRemoteContentHash: row.last_remote_content_hash,
    lastRemoteRevision: row.last_remote_revision,
    lastResultCode: row.last_result_code,
    lastSuccessfulSyncAt: row.last_successful_sync_at,
    pendingOperationId: row.pending_operation_id,
  };
}

export function createSyncStateRepository(database: SQLiteDatabase) {
  const getState = async (): Promise<SyncState> => {
    const row = await database.getFirstAsync<SyncStateRow>(
      `SELECT last_remote_revision, last_remote_content_hash,
              last_local_content_hash, last_successful_sync_at,
              last_result_code, pending_operation_id
       FROM sync_state WHERE id = 1`
    );
    if (!row) throw new SyncStateError('state_missing');
    return syncStateFromRow(row);
  };

  return {
    getState,
    async markPending(operationId: string, at: string): Promise<void> {
      const result = await database.runAsync(
        `UPDATE sync_state
         SET pending_operation_id = ?, updated_at = ? WHERE id = 1`,
        operationId,
        at
      );
      if (result.changes !== 1) throw new SyncStateError('state_write_failed');
    },
    async recordResult(code: SyncResultCode, at: string): Promise<void> {
      const result = await database.runAsync(
        `UPDATE sync_state
         SET last_result_code = ?, pending_operation_id = NULL, updated_at = ?
         WHERE id = 1`,
        code,
        at
      );
      if (result.changes !== 1) throw new SyncStateError('state_write_failed');
    },
    async recordSuccess(
      revision: number,
      remoteHash: string,
      localHash: string,
      at: string
    ): Promise<void> {
      const result = await database.runAsync(
        `UPDATE sync_state
         SET last_remote_revision = ?, last_remote_content_hash = ?,
             last_local_content_hash = ?, last_successful_sync_at = ?,
             last_result_code = 'completed', pending_operation_id = NULL,
             updated_at = ?
         WHERE id = 1`,
        revision,
        remoteHash,
        localHash,
        at,
        at
      );
      if (result.changes !== 1) throw new SyncStateError('state_write_failed');
    },
  };
}
