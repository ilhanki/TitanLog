import type { SQLiteDatabase } from 'expo-sqlite';

import packageJson from '../../../package.json';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupData,
  type BackupRow,
  type BackupTableName,
  type TitanLogBackup,
} from '@/features/data-safety/backup-types';
import {
  createBackupSummary,
  validateBackup,
} from '@/features/data-safety/backup-validator';

const INSERT_ORDER: BackupTableName[] = [
  'workout_plans',
  'workout_days',
  'exercises',
  'workout_day_schedules',
  'workout_day_exercises',
  'workout_sessions',
  'workout_session_exercises',
  'workout_sets',
  'body_profiles',
  'body_measurements',
];
const DELETE_ORDER = [...INSERT_ORDER].reverse();

export async function createBackupArchive(
  database: SQLiteDatabase
): Promise<TitanLogBackup> {
  let archive: TitanLogBackup | null = null;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const metadata = await transaction.getFirstAsync<{
      installation_id: string;
    }>('SELECT installation_id FROM dataset_metadata WHERE id = 1');
    if (!metadata) throw new Error('dataset_metadata_missing');
    const entries = await Promise.all(
      BACKUP_TABLES.map(
        async (table) =>
          [
            table,
            await transaction.getAllAsync<BackupRow>(
              `SELECT * FROM ${table} ORDER BY id`
            ),
          ] as const
      )
    );
    const data = Object.fromEntries(entries) as BackupData;
    archive = validateBackup({
      appVersion: packageJson.version,
      createdAt: new Date().toISOString(),
      data,
      deviceId: metadata.installation_id,
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      summary: createBackupSummary(data),
    });
  });
  if (!archive) throw new Error('backup_snapshot_failed');
  return archive;
}

export async function restoreBackupArchive(
  database: SQLiteDatabase,
  archive: TitanLogBackup
): Promise<void> {
  const validated = validateBackup(archive);
  await database.withExclusiveTransactionAsync(async (transaction) => {
    for (const table of DELETE_ORDER)
      await transaction.runAsync(`DELETE FROM ${table}`);
    for (const table of INSERT_ORDER) {
      for (const row of validated.data[table]) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(', ');
        await transaction.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          ...columns.map((column) => row[column] as BackupRow[string])
        );
      }
    }
    const integrity = await transaction.getAllAsync<{ table: string }>(
      'PRAGMA foreign_key_check'
    );
    if (integrity.length > 0) throw new Error('restore_integrity_failed');
  });
}
