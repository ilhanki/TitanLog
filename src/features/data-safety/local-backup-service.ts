import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createBackupArchive } from '@/features/data-safety/backup-repository';
import {
  deserializeBackup,
  serializeBackup,
} from '@/features/data-safety/backup-serialization';
import {
  MAX_BACKUP_BYTES,
  type TitanLogBackup,
} from '@/features/data-safety/backup-types';
import { createDatasetOwnershipRepository } from '@/features/data-safety/dataset-ownership-repository';

function backupFileName(createdAt: string): string {
  return `titanlog-${createdAt.replace(/[:.]/g, '-')}.titanlog`;
}

export async function shareLocalBackup(
  database: SQLiteDatabase
): Promise<TitanLogBackup> {
  const archive = await createBackupArchive(database);
  const file = new File(Paths.cache, backupFileName(archive.createdAt));
  try {
    file.create({ overwrite: true });
    file.write(serializeBackup(archive));
    if (!(await isAvailableAsync())) throw new Error('sharing_unavailable');
    await shareAsync(file.uri, {
      dialogTitle: 'TitanLog Yerel Yedeği',
      mimeType: 'application/json',
      UTI: 'public.json',
    });
    await createDatasetOwnershipRepository(database).markBackup(
      'local',
      archive.createdAt
    );
    return archive;
  } finally {
    if (file.exists) file.delete();
  }
}

export async function pickLocalBackup(): Promise<TitanLogBackup | null> {
  const result = await getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ['application/json', 'application/octet-stream', 'text/plain'],
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || !asset.name.toLowerCase().endsWith('.titanlog')) {
    throw new Error('invalid_extension');
  }
  const file = new File(asset.uri);
  if (file.size > MAX_BACKUP_BYTES) throw new Error('oversized');
  return deserializeBackup(await file.text());
}
