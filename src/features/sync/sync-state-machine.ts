import {
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
} from '@/features/data-safety/backup-types';
import type {
  ManualSyncPhase,
  RemoteSyncHead,
  SyncState,
} from '@/features/sync/sync-types';

export type SyncDecision = {
  hasLocalChanges: boolean;
  hasRemoteChanges: boolean;
  phase: ManualSyncPhase;
};

export function decideManualSync(
  localHash: string,
  state: SyncState,
  remoteHead: RemoteSyncHead | null
): SyncDecision {
  if (!remoteHead) {
    return {
      hasLocalChanges: true,
      hasRemoteChanges: false,
      phase: 'cloud_empty',
    };
  }
  if (
    remoteHead.archiveFormatVersion !== BACKUP_FORMAT_VERSION ||
    remoteHead.archiveSchemaVersion !== BACKUP_SCHEMA_VERSION
  ) {
    return {
      hasLocalChanges: false,
      hasRemoteChanges: true,
      phase: 'unsupported_remote_version',
    };
  }
  if (localHash === remoteHead.contentHash) {
    return {
      hasLocalChanges: false,
      hasRemoteChanges: false,
      phase: 'unchanged',
    };
  }
  if (
    state.lastLocalContentHash === null ||
    state.lastRemoteRevision === null ||
    state.lastRemoteContentHash === null
  ) {
    return {
      hasLocalChanges: true,
      hasRemoteChanges: true,
      phase: 'conflict',
    };
  }
  const hasLocalChanges = localHash !== state.lastLocalContentHash;
  const hasRemoteChanges =
    remoteHead.revision !== state.lastRemoteRevision ||
    remoteHead.contentHash !== state.lastRemoteContentHash;
  let phase: ManualSyncPhase = 'unchanged';
  if (hasLocalChanges && hasRemoteChanges) phase = 'conflict';
  else if (hasLocalChanges) phase = 'local_changed';
  else if (hasRemoteChanges) phase = 'cloud_changed';
  return { hasLocalChanges, hasRemoteChanges, phase };
}
