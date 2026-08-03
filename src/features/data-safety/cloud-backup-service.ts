import type { SQLiteDatabase } from 'expo-sqlite';

import { getSupabaseClient } from '@/features/auth/supabase-client';
import { createBackupArchive } from '@/features/data-safety/backup-repository';
import {
  deserializeBackup,
  serializeBackup,
} from '@/features/data-safety/backup-serialization';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';
import { createDatasetOwnershipRepository } from '@/features/data-safety/dataset-ownership-repository';
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
  const { client, user } = await requireAuthenticatedClient();
  await createDatasetOwnershipRepository(database).assertCloudAccess(user.id);
  const { data, error } = await client.storage
    .from(CLOUD_BACKUP_BUCKET)
    .download(userBackupPath(user.id));
  if (error || !data) throw new CloudBackupError('remote_failure');
  const { data: metadata, error: metadataError } = await client
    .from('backup_metadata')
    .select('byte_size, content_hash')
    .eq('user_id', user.id)
    .single();
  if (metadataError || !metadata) throw new CloudBackupError('remote_failure');
  if (
    !Number.isSafeInteger(metadata.byte_size) ||
    metadata.byte_size <= 0 ||
    typeof metadata.content_hash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(metadata.content_hash)
  )
    throw new CloudBackupError('validation_failure');
  const serialized = await data.text();
  if (
    new TextEncoder().encode(serialized).byteLength !== metadata.byte_size ||
    (await hashCanonicalArchive(serialized)) !== metadata.content_hash
  )
    throw new CloudBackupError('validation_failure');
  return deserializeBackup(serialized);
}
