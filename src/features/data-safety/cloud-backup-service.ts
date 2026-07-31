import type { SQLiteDatabase } from 'expo-sqlite';

import { getSupabaseClient } from '@/features/auth/supabase-client';
import { createBackupArchive } from '@/features/data-safety/backup-repository';
import {
  deserializeBackup,
  serializeBackup,
} from '@/features/data-safety/backup-serialization';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';
import { createDatasetOwnershipRepository } from '@/features/data-safety/dataset-ownership-repository';

export const CLOUD_BACKUP_BUCKET = 'titanlog-backups';

export class CloudBackupError extends Error {
  constructor(
    readonly code: 'not_authenticated' | 'not_configured' | 'remote_failure'
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
  const bytes = new TextEncoder().encode(serializeBackup(archive));
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
  return deserializeBackup(await data.text());
}
