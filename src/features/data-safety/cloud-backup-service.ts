import type { SQLiteDatabase } from 'expo-sqlite';

import { getSupabaseClient } from '@/features/auth/supabase-client';
import {
  CloudBackupDownloadError,
  createCloudBackupDownloadError,
  httpStatusCategory,
  logCloudBackupDownloadFailure,
  type CloudBackupDownloadDiagnostic,
  type CloudBackupDownloadErrorCode,
  type CloudBackupDownloadStage,
} from '@/features/data-safety/cloud-backup-diagnostics';
import { createBackupArchive } from '@/features/data-safety/backup-repository';
import {
  deserializeBackup,
  serializeBackup,
} from '@/features/data-safety/backup-serialization';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';
import { BackupValidationError } from '@/features/data-safety/backup-validator';
import {
  createDatasetOwnershipRepository,
  DatasetOwnershipError,
} from '@/features/data-safety/dataset-ownership-repository';
import { hashCanonicalArchive } from '@/features/sync/canonical-sync-archive';

export const CLOUD_BACKUP_BUCKET = 'titanlog-backups';

export class CloudBackupError extends Error {
  constructor(
    readonly code:
      | 'not_authenticated'
      | 'not_configured'
      | 'remote_failure'
      | 'validation_failure'
  ) {
    super(code);
  }
}

async function requireAuthenticatedClient() {
  const client = getSupabaseClient();
  if (!client) throw new CloudBackupError('not_configured');
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new CloudBackupError('not_authenticated');
  return { client, user: data.user };
}

function userBackupPath(userId: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId
    )
  )
    throw new CloudBackupError('not_authenticated');
  return `${userId}/latest.titanlog`;
}

export function readCloudBackupBlob(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('blob_result_invalid'));
    reader.onerror = () => reject(new Error('blob_read_failed'));
    try {
      reader.readAsText(blob, 'UTF-8');
    } catch {
      reject(new Error('blob_read_failed'));
    }
  });
}

function downloadFailure(
  stage: CloudBackupDownloadStage,
  code: CloudBackupDownloadErrorCode,
  diagnostic: Omit<CloudBackupDownloadDiagnostic, 'code' | 'stage'> = {}
): CloudBackupDownloadError {
  return createCloudBackupDownloadError({ ...diagnostic, code, stage });
}

export async function uploadCloudBackup(
  database: SQLiteDatabase
): Promise<TitanLogBackup> {
  const { client, user } = await requireAuthenticatedClient();
  const ownership = createDatasetOwnershipRepository(database);
  await ownership.assertCloudAccess(user.id);
  const archive = await createBackupArchive(database);
  const serialized = serializeBackup(archive);
  const bytes = new TextEncoder().encode(serialized);
  const contentHash = await hashCanonicalArchive(serialized);
  const { error } = await client.storage
    .from(CLOUD_BACKUP_BUCKET)
    .upload(userBackupPath(user.id), bytes.buffer, {
      contentType: 'application/json',
      upsert: true,
    });
  if (error) throw new CloudBackupError('remote_failure');
  const { error: metadataError } = await client.from('backup_metadata').upsert(
    {
      app_version: archive.appVersion,
      byte_size: bytes.byteLength,
      content_hash: contentHash,
      created_at: archive.createdAt,
      format_version: archive.formatVersion,
      summary: archive.summary,
      updated_at: archive.createdAt,
      user_id: user.id,
    },
    { onConflict: 'user_id' }
  );
  if (metadataError) throw new CloudBackupError('remote_failure');
  await ownership.markBackup('cloud', archive.createdAt);
  return archive;
}

export async function downloadCloudBackup(
  database: SQLiteDatabase
): Promise<TitanLogBackup> {
  try {
    const client = getSupabaseClient();
    if (!client) throw downloadFailure('session', 'not_configured');
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user)
      throw downloadFailure('session', 'not_authenticated', {
        httpStatusCategory: httpStatusCategory(authError),
      });

    try {
      await createDatasetOwnershipRepository(database).assertCloudAccess(
        auth.user.id
      );
    } catch (error) {
      if (error instanceof DatasetOwnershipError) {
        throw downloadFailure(
          'ownership',
          error.code === 'owner_mismatch'
            ? 'ownership_mismatch'
            : 'ownership_required'
        );
      }
      throw downloadFailure('ownership', 'unknown_failure');
    }

    let metadataResult: {
      data: { byte_size: number | null; content_hash: string | null } | null;
      error: unknown;
    };
    try {
      metadataResult = await client
        .from('backup_metadata')
        .select('byte_size, content_hash')
        .eq('user_id', auth.user.id)
        .maybeSingle();
    } catch (error) {
      throw downloadFailure('metadata_query', 'metadata_query_failed', {
        httpStatusCategory: httpStatusCategory(error),
        metadataExists: false,
      });
    }
    if (metadataResult.error)
      throw downloadFailure('metadata_query', 'metadata_query_failed', {
        httpStatusCategory: httpStatusCategory(metadataResult.error),
        metadataExists: false,
      });
    const metadata = metadataResult.data;
    if (!metadata)
      throw downloadFailure('metadata_query', 'metadata_not_found', {
        metadataExists: false,
      });
    const expectedByteSize = metadata.byte_size;
    const expectedHash = metadata.content_hash;
    const hashMetadataExists =
      typeof expectedHash === 'string' && expectedHash.length > 0;
    if (
      typeof expectedByteSize !== 'number' ||
      !Number.isSafeInteger(expectedByteSize) ||
      expectedByteSize <= 0 ||
      !hashMetadataExists ||
      typeof expectedHash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(expectedHash)
    )
      throw downloadFailure('metadata_validation', 'metadata_invalid', {
        hashMetadataExists,
        metadataExists: true,
      });

    let storageResult: { data: Blob | null; error: unknown };
    try {
      storageResult = await client.storage
        .from(CLOUD_BACKUP_BUCKET)
        .download(userBackupPath(auth.user.id));
    } catch (error) {
      throw downloadFailure('storage_download', 'storage_download_failed', {
        expectedByteSize,
        hashMetadataExists: true,
        httpStatusCategory: httpStatusCategory(error),
        metadataExists: true,
        storageObjectExists: false,
      });
    }
    if (storageResult.error || !storageResult.data)
      throw downloadFailure('storage_download', 'storage_download_failed', {
        expectedByteSize,
        hashMetadataExists: true,
        httpStatusCategory: httpStatusCategory(storageResult.error),
        metadataExists: true,
        storageObjectExists: false,
      });

    let serialized: string;
    try {
      serialized = await readCloudBackupBlob(storageResult.data);
    } catch {
      throw downloadFailure('blob_conversion', 'blob_conversion_failed', {
        expectedByteSize,
        hashMetadataExists: true,
        metadataExists: true,
        storageObjectExists: true,
      });
    }
    const actualByteSize = new TextEncoder().encode(serialized).byteLength;
    if (actualByteSize !== expectedByteSize)
      throw downloadFailure('size_validation', 'size_mismatch', {
        actualByteSize,
        expectedByteSize,
        hashMetadataExists: true,
        metadataExists: true,
        sizeMatched: false,
        storageObjectExists: true,
      });
    let hashMatched: boolean;
    try {
      hashMatched = (await hashCanonicalArchive(serialized)) === expectedHash;
    } catch {
      throw downloadFailure('hash_validation', 'hash_calculation_failed', {
        actualByteSize,
        expectedByteSize,
        hashMetadataExists: true,
        metadataExists: true,
        sizeMatched: true,
        storageObjectExists: true,
      });
    }
    if (!hashMatched)
      throw downloadFailure('hash_validation', 'hash_mismatch', {
        actualByteSize,
        expectedByteSize,
        hashMatched: false,
        hashMetadataExists: true,
        metadataExists: true,
        sizeMatched: true,
        storageObjectExists: true,
      });

    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw downloadFailure('archive_parse', 'archive_parse_failed', {
        actualByteSize,
        expectedByteSize,
        hashMatched: true,
        hashMetadataExists: true,
        metadataExists: true,
        sizeMatched: true,
        storageObjectExists: true,
      });
    }
    const envelope = parsed as Record<string, unknown>;
    const archiveVersions = {
      archiveFitnessSchemaVersion: Number.isSafeInteger(envelope.schemaVersion)
        ? Number(envelope.schemaVersion)
        : undefined,
      archiveFormatVersion: Number.isSafeInteger(envelope.formatVersion)
        ? Number(envelope.formatVersion)
        : undefined,
    };
    let archive: TitanLogBackup;
    try {
      archive = deserializeBackup(serialized);
    } catch (error) {
      throw downloadFailure(
        error instanceof BackupValidationError &&
          error.code === 'malformed_json'
          ? 'archive_parse'
          : 'archive_validation',
        error instanceof BackupValidationError &&
          error.code === 'malformed_json'
          ? 'archive_parse_failed'
          : 'archive_validation_failed',
        {
          ...archiveVersions,
          actualByteSize,
          expectedByteSize,
          hashMatched: true,
          hashMetadataExists: true,
          metadataExists: true,
          sizeMatched: true,
          storageObjectExists: true,
        }
      );
    }
    if (serializeBackup(archive) !== serialized)
      throw downloadFailure(
        'canonical_validation',
        'canonical_validation_failed',
        {
          ...archiveVersions,
          actualByteSize,
          expectedByteSize,
          hashMatched: true,
          hashMetadataExists: true,
          metadataExists: true,
          sizeMatched: true,
          storageObjectExists: true,
        }
      );
    return archive;
  } catch (error) {
    const normalized =
      error instanceof CloudBackupDownloadError
        ? error
        : downloadFailure('session', 'unknown_failure');
    logCloudBackupDownloadFailure(normalized);
    throw normalized;
  }
}
