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
  archiveSchemaVersion: number;
  byteSize: number;
  contentHash: string;
  revision: number;
  summary: BackupSummary;
  updatedAt: string;
};

export type HashedSyncArchive = {
  archive: TitanLogBackup;
  byteSize: number;
  contentHash: string;
  serialized: string;
};
