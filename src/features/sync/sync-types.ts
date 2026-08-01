import type {
  BackupSummary,
  TitanLogBackup,
} from '@/features/data-safety/backup-types';

export type SyncResultCode =
  | 'completed'
  | 'unchanged'
  | 'cancelled'
  | 'offline'
  | 'conflict'
  | 'unsupported_remote_version'
  | 'validation_failure'
  | 'authentication_failure'
  | 'recoverable_server_failure';

export type SyncState = {
  lastLocalContentHash: string | null;
  lastRemoteContentHash: string | null;
  lastRemoteRevision: number | null;
  lastResultCode: SyncResultCode | null;
  lastSuccessfulSyncAt: string | null;
  pendingOperationId: string | null;
};

export type RemoteSyncHead = {
  archiveFormatVersion: number;
  archiveSchemaVersion: number;
  byteSize: number;
  contentHash: string;
  revision: number;
  summary: BackupSummary;
  updatedAt: string;
};

export type ManualSyncPhase =
  | 'signed_out'
  | 'dataset_unowned'
  | 'account_mismatch'
  | 'ready'
  | 'checking_cloud'
  | 'cloud_empty'
  | 'uploading'
  | 'downloading'
  | 'unchanged'
  | 'local_changed'
  | 'cloud_changed'
  | 'conflict'
  | 'completed'
  | 'offline'
  | 'unsupported_remote_version'
  | 'validation_failure'
  | 'authentication_failure'
  | 'recoverable_server_failure';

export type SyncIdentityState =
  'signed_out' | 'dataset_unowned' | 'account_mismatch' | 'owned';

export type SyncCheck = {
  hasLocalChanges: boolean;
  hasRemoteChanges: boolean;
  local: HashedSyncArchive | null;
  phase: ManualSyncPhase;
  remoteHead: RemoteSyncHead | null;
  state: SyncState | null;
};

export type HashedSyncArchive = {
  archive: TitanLogBackup;
  byteSize: number;
  contentHash: string;
  serialized: string;
};
