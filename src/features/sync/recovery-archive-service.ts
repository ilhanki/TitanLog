import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createBackupArchive } from '@/features/data-safety/backup-repository';
import {
  deserializeBackup,
  serializeBackup,
} from '@/features/data-safety/backup-serialization';
import type { TitanLogBackup } from '@/features/data-safety/backup-types';

const RECOVERY_DIRECTORY = 'titanlog-recovery';
const RECOVERY_FILE = 'pre-sync-recovery.titanlog';

function recoveryDirectory(): Directory {
  return new Directory(Paths.document, RECOVERY_DIRECTORY);
}

function recoveryFile(): File {
  return new File(recoveryDirectory(), RECOVERY_FILE);
}

export function hasRecoveryArchive(): boolean {
  return recoveryFile().exists;
}

export async function readRecoveryArchive(): Promise<TitanLogBackup> {
  const file = recoveryFile();
  if (!file.exists) throw new Error('recovery_missing');
  return deserializeBackup(await file.text());
}

export async function createRecoveryArchive(
  database: SQLiteDatabase
): Promise<TitanLogBackup> {
  const archive = await createBackupArchive(database);
  const serialized = serializeBackup(archive);
  const directory = recoveryDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const file = recoveryFile();
  file.create({ overwrite: true });
  file.write(serialized);
  if (!file.exists || !file.size || file.size <= 0)
    throw new Error('recovery_write_failed');
  deserializeBackup(await file.text());
  return archive;
}

export async function shareRecoveryArchive(): Promise<void> {
  const file = recoveryFile();
  if (!file.exists) throw new Error('recovery_missing');
  if (!(await isAvailableAsync())) throw new Error('sharing_unavailable');
  await shareAsync(file.uri, {
    dialogTitle: 'TitanLog Eşitleme Kurtarma Kopyası',
    mimeType: 'application/octet-stream',
    UTI: 'public.data',
  });
}
