import { fetch } from 'expo/fetch';
import { getNetworkStateAsync } from 'expo-network';

import { getSupabaseClient } from '@/features/auth/supabase-client';
import {
  deserializeBackup,
  serializeBackup,
} from '@/features/data-safety/backup-serialization';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_BYTES,
  type BackupSummary,
  type TitanLogBackup,
} from '@/features/data-safety/backup-types';
import { hashCanonicalArchive } from '@/features/sync/canonical-sync-archive';
import type {
  HashedSyncArchive,
  RemoteSyncHead,
} from '@/features/sync/sync-types';

export type RemoteSyncErrorCode =
  | 'not_configured'
  | 'authentication_failure'
  | 'offline'
  | 'stale_revision'
  | 'unsupported_remote_version'
  | 'validation_failure'
  | 'recoverable_server_failure';

export class RemoteSyncError extends Error {
  constructor(readonly code: RemoteSyncErrorCode) {
    super(code);
    this.name = 'RemoteSyncError';
  }
}

type PullResponse = {
  downloadUrl?: string;
  empty: boolean;
  head?: RemoteSyncHead;
};

function isRemoteHead(value: unknown): value is RemoteSyncHead {
  if (typeof value !== 'object' || value === null) return false;
  const head = value as Record<string, unknown>;
  const summary = head.summary as BackupSummary | undefined;
  return (
    Number.isSafeInteger(head.archiveFormatVersion) &&
    Number.isSafeInteger(head.archiveSchemaVersion) &&
    Number.isSafeInteger(head.byteSize) &&
    typeof head.contentHash === 'string' &&
    /^[0-9a-f]{64}$/.test(head.contentHash) &&
    Number.isSafeInteger(head.revision) &&
    Number(head.revision) > 0 &&
    typeof head.updatedAt === 'string' &&
    typeof summary === 'object' &&
    summary !== null
  );
}

async function assertOnline(): Promise<void> {
  const network = await getNetworkStateAsync();
  if (!network.isConnected || network.isInternetReachable === false)
    throw new RemoteSyncError('offline');
}

async function requireClient() {
  await assertOnline();
  const client = getSupabaseClient();
  if (!client) throw new RemoteSyncError('not_configured');
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new RemoteSyncError('authentication_failure');
  return client;
}

export async function fetchRemoteSyncHead(): Promise<RemoteSyncHead | null> {
  const client = await requireClient();
  const { data, error } = await client.functions.invoke<PullResponse>(
    'sync-pull',
    { body: {} }
  );
  if (error || !data) throw new RemoteSyncError('recoverable_server_failure');
  if (data.empty) return null;
  if (!isRemoteHead(data.head)) throw new RemoteSyncError('validation_failure');
  return data.head;
}

export async function pushRemoteSyncArchive(
  local: HashedSyncArchive,
  expectedRevision: number,
  operationId: string
): Promise<{ contentHash: string; revision: number }> {
  const client = await requireClient();
  const { data, error } = await client.functions.invoke('sync-push', {
    body: {
      archive: local.serialized,
      contentHash: local.contentHash,
      expectedRevision,
      operationId,
    },
  });
  if (error) {
    const status = Number(
      (error as { context?: { status?: unknown } }).context?.status ?? 0
    );
    throw new RemoteSyncError(
      status === 409
        ? 'stale_revision'
        : status === 401
          ? 'authentication_failure'
          : 'recoverable_server_failure'
    );
  }
  const result = data as Record<string, unknown> | null;
  if (
    !result ||
    !Number.isSafeInteger(result.revision) ||
    typeof result.contentHash !== 'string' ||
    result.contentHash !== local.contentHash
  )
    throw new RemoteSyncError('validation_failure');
  return {
    contentHash: result.contentHash,
    revision: Number(result.revision),
  };
}

export async function downloadRemoteSyncArchive(
  expectedHead: RemoteSyncHead
): Promise<TitanLogBackup> {
  const client = await requireClient();
  const { data, error } = await client.functions.invoke<PullResponse>(
    'sync-pull',
    { body: {} }
  );
  if (error || !data?.head || !data.downloadUrl)
    throw new RemoteSyncError('recoverable_server_failure');
  if (!isRemoteHead(data.head)) throw new RemoteSyncError('validation_failure');
  if (
    data.head.revision !== expectedHead.revision ||
    data.head.contentHash !== expectedHead.contentHash
  )
    throw new RemoteSyncError('stale_revision');
  if (
    data.head.archiveFormatVersion !== BACKUP_FORMAT_VERSION ||
    data.head.archiveSchemaVersion !== BACKUP_SCHEMA_VERSION
  )
    throw new RemoteSyncError('unsupported_remote_version');
  if (data.head.byteSize > MAX_BACKUP_BYTES)
    throw new RemoteSyncError('validation_failure');

  const response = await fetch(data.downloadUrl);
  if (!response.ok) throw new RemoteSyncError('recoverable_server_failure');
  const serialized = await response.text();
  if (new TextEncoder().encode(serialized).byteLength !== data.head.byteSize)
    throw new RemoteSyncError('validation_failure');
  if ((await hashCanonicalArchive(serialized)) !== data.head.contentHash)
    throw new RemoteSyncError('validation_failure');
  try {
    const archive = deserializeBackup(serialized);
    if (serializeBackup(archive) !== serialized)
      throw new Error('non_canonical');
    return archive;
  } catch {
    throw new RemoteSyncError('validation_failure');
  }
}
